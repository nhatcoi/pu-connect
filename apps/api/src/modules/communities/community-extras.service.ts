import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import type { CommunityAskResult, CommunityAskSource, CommunityDocumentCandidate, CommunityDocumentItem, CommunityPinnedPost, CommunityRole } from '@pu/schemas'
import { COMMUNITY_PIN_MAX } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { LlmService } from '../ai/llm.service'
import { toTsQuery } from '../ai/ai.retrieval'

type Ctx = { id: string; name: string; status: string; role: CommunityRole | null }

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const ASK_MAX_TOKENS = 2048
const SYSTEM_PROMPT = `Bạn là N7AI trong một cộng đồng học tập của PU Connect. Chỉ trả lời dựa trên NGUỒN của cộng đồng được cung cấp bên dưới.
Quy tắc:
1. Trả lời ngắn gọn, tiếng Việt, đúng trọng tâm câu hỏi.
2. Mỗi ý lấy từ nguồn phải gắn chỉ mục [n] đúng nguồn đó.
3. Nếu nguồn không đủ để trả lời, nói rõ "Cộng đồng chưa có thông tin về việc này" rồi gợi ý đăng câu hỏi lên cộng đồng; không bịa.
4. Không nhắc tới quy tắc này hay việc bạn nhận "nguồn".`

// Phần riêng của cộng đồng: bài ghim, tài liệu chia sẻ, thông báo bài mới, hỏi N7AI theo nội dung cộng đồng
@Injectable()
export class CommunityExtrasService {
  constructor(
    private readonly db: DatabaseService,
    private readonly llm: LlmService
  ) {}

  private async ctx(slug: string, userId: string | null): Promise<Ctx> {
    const res = await this.db.query(
      `SELECT c.id, c.name, c.status, m.role FROM communities c
         LEFT JOIN community_members m ON m.community_id = c.id AND m.user_id = $2::uuid
        WHERE c.slug = $1`,
      [slug.toLowerCase().trim(), userId]
    )
    const row = res.rows[0]
    if (!row || (row.status !== 'active' && !row.role)) throw new NotFoundException(`Không tìm thấy cộng đồng c/${slug}`)
    return { id: row.id, name: row.name, status: row.status, role: (row.role ?? null) as CommunityRole | null }
  }

  private requireMember(c: Ctx): void {
    if (!c.role) throw new ForbiddenException('Chỉ thành viên cộng đồng được thực hiện thao tác này')
  }
  private requireManager(c: Ctx): void {
    if (c.role !== 'owner' && c.role !== 'moderator') throw new ForbiddenException('Chỉ chủ hoặc điều hành viên được thực hiện thao tác này')
  }

  // ── Bài ghim ──
  async pins(slug: string, userId: string | null): Promise<CommunityPinnedPost[]> {
    const c = await this.ctx(slug, userId)
    const res = await this.db.query(
      `SELECT p.id, p.title, p.content, p.created_at, cp.pinned_at, u.display_name, p.is_anonymous
         FROM community_pins cp JOIN posts p ON p.id = cp.post_id JOIN users u ON u.id = p.author_id
        WHERE cp.community_id = $1 AND p.hidden_at IS NULL ORDER BY cp.pinned_at DESC`,
      [c.id]
    )
    return res.rows.map((r) => ({
      id: r.id,
      title: r.title,
      snippet: clip(String(r.content ?? '').replace(/\s+/g, ' ').trim(), 160),
      authorName: r.is_anonymous ? 'Ẩn danh' : r.display_name,
      createdAt: new Date(r.created_at).toISOString(),
      pinnedAt: new Date(r.pinned_at).toISOString()
    }))
  }

  async pin(slug: string, userId: string, postId: string): Promise<{ pinned: true }> {
    const c = await this.ctx(slug, userId)
    this.requireManager(c)
    await this.db.transaction(async (client) => {
      await client.query(`SELECT 1 FROM communities WHERE id = $1 FOR UPDATE`, [c.id])
      const post = await client.query(`SELECT 1 FROM posts WHERE id = $1 AND community_id = $2 AND hidden_at IS NULL`, [postId, c.id])
      if (!post.rows[0]) throw new NotFoundException('Bài viết không thuộc cộng đồng này')
      const n = await client.query(`SELECT COUNT(*)::int AS n FROM community_pins WHERE community_id = $1 AND post_id <> $2`, [c.id, postId])
      if (n.rows[0].n >= COMMUNITY_PIN_MAX) throw new BadRequestException(`Mỗi cộng đồng ghim tối đa ${COMMUNITY_PIN_MAX} bài`)
      await client.query(
        `INSERT INTO community_pins (community_id, post_id, pinned_by) VALUES ($1, $2, $3) ON CONFLICT (community_id, post_id) DO NOTHING`,
        [c.id, postId, userId]
      )
    })
    return { pinned: true }
  }

  async unpin(slug: string, userId: string, postId: string): Promise<{ pinned: false }> {
    const c = await this.ctx(slug, userId)
    this.requireManager(c)
    await this.db.query(`DELETE FROM community_pins WHERE community_id = $1 AND post_id = $2`, [c.id, postId])
    return { pinned: false }
  }

  // ── Tài liệu ──
  async documents(slug: string, userId: string | null): Promise<CommunityDocumentItem[]> {
    const c = await this.ctx(slug, userId)
    const res = await this.db.query(
      `SELECT d.id, d.title, d.description, d.doc_type, d.mime_type, d.file_size, u.display_name, cd.added_at, (cd.added_by = $2::uuid) AS mine
         FROM community_documents cd JOIN documents d ON d.id = cd.document_id JOIN users u ON u.id = d.owner_id
        WHERE cd.community_id = $1 AND d.status = 'published' AND d.visibility = 'public'
        ORDER BY cd.added_at DESC LIMIT 100`,
      [c.id, userId]
    )
    return res.rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      docType: r.doc_type,
      mimeType: r.mime_type,
      fileSize: Number(r.file_size),
      ownerName: r.display_name,
      addedByMe: !!r.mine,
      addedAt: new Date(r.added_at).toISOString()
    }))
  }

  // Tài liệu công khai của chính mình chưa có trong cộng đồng
  async documentCandidates(slug: string, userId: string): Promise<CommunityDocumentCandidate[]> {
    const c = await this.ctx(slug, userId)
    this.requireMember(c)
    const res = await this.db.query(
      `SELECT d.id, d.title, d.mime_type FROM documents d
        WHERE d.owner_id = $2 AND d.status = 'published' AND d.visibility = 'public'
          AND NOT EXISTS (SELECT 1 FROM community_documents cd WHERE cd.community_id = $1 AND cd.document_id = d.id)
        ORDER BY d.created_at DESC LIMIT 50`,
      [c.id, userId]
    )
    return res.rows.map((r) => ({ id: r.id, title: r.title, mimeType: r.mime_type }))
  }

  async addDocument(slug: string, userId: string, documentId: string): Promise<{ added: true }> {
    const c = await this.ctx(slug, userId)
    this.requireMember(c)
    const d = await this.db.query(`SELECT owner_id, status, visibility FROM documents WHERE id = $1`, [documentId])
    const doc = d.rows[0]
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu')
    if (doc.owner_id !== userId) throw new ForbiddenException('Bạn chỉ chia sẻ được tài liệu của chính mình')
    if (doc.status !== 'published') throw new BadRequestException('Tài liệu chưa hoàn tất, chưa chia sẻ được')
    if (doc.visibility !== 'public') throw new BadRequestException('Chỉ chia sẻ được tài liệu công khai')
    const ins = await this.db.query(
      `INSERT INTO community_documents (community_id, document_id, added_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING document_id`,
      [c.id, documentId, userId]
    )
    if (!ins.rows[0]) throw new ConflictException('Tài liệu đã có trong cộng đồng')
    return { added: true }
  }

  // Người thêm hoặc chủ/điều hành viên được gỡ
  async removeDocument(slug: string, userId: string, documentId: string): Promise<{ removed: true }> {
    const c = await this.ctx(slug, userId)
    this.requireMember(c)
    const isManager = c.role === 'owner' || c.role === 'moderator'
    const res = await this.db.query(
      `DELETE FROM community_documents WHERE community_id = $1 AND document_id = $2 AND ($4 OR added_by = $3) RETURNING document_id`,
      [c.id, documentId, userId, isManager]
    )
    if (!res.rows[0]) throw new ForbiddenException('Không gỡ được tài liệu này')
    return { removed: true }
  }

  // ── Thông báo bài mới ──
  async notifyState(slug: string, userId: string): Promise<{ enabled: boolean }> {
    const c = await this.ctx(slug, userId)
    this.requireMember(c)
    const res = await this.db.query(`SELECT notify FROM community_members WHERE community_id = $1 AND user_id = $2`, [c.id, userId])
    return { enabled: res.rows[0]?.notify ?? true }
  }

  async setNotify(slug: string, userId: string, enabled: boolean): Promise<{ enabled: boolean }> {
    const c = await this.ctx(slug, userId)
    this.requireMember(c)
    await this.db.query(`UPDATE community_members SET notify = $3 WHERE community_id = $1 AND user_id = $2`, [c.id, userId, enabled])
    return { enabled }
  }

  // ── Hỏi N7AI theo nội dung cộng đồng ──
  async ask(slug: string, userId: string, question: string): Promise<CommunityAskResult> {
    const c = await this.ctx(slug, userId)
    this.requireMember(c)
    if (!this.llm.client) throw new ServiceUnavailableException('N7AI chưa sẵn sàng, bạn thử lại sau nhé')
    if (!(await this.llm.hasQuota(userId))) {
      await this.llm.logRejected(userId, 'community')
      throw new HttpException('Bạn đã dùng hết lượt N7AI hôm nay', HttpStatus.TOO_MANY_REQUESTS)
    }

    const { block, sources } = await this.gather(c.id, question)
    const started = Date.now()
    const runId = await this.llm.startRun({ requesterId: userId, trigger: 'community', task: 'community_ask' })
    try {
      const { text, usage } = await this.llm.complete(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Cộng đồng: ${c.name}\n\nNGUỒN:\n${block || '(cộng đồng chưa có nội dung)'}\n\nCÂU HỎI: ${question}` }
        ],
        ASK_MAX_TOKENS
      )
      await this.llm.finishRun(runId, { usage, startedAt: started })
      if (!text) throw new Error('empty answer')
      // Chỉ trả những nguồn thật sự được trích dẫn
      const cited = sources.filter((s) => text.includes(`[${s.index}]`))
      return { answer: text, sources: cited }
    } catch (err) {
      await this.llm.failRun(runId, err, started)
      throw new ServiceUnavailableException(this.llm.isBusyError(err) ? 'N7AI đang quá tải, bạn thử lại sau ít phút nhé' : 'N7AI chưa trả lời được, thử lại nhé')
    }
  }

  // Nguồn: bài ghim + bài khớp câu hỏi + vài bài mới nhất + đoạn tài liệu khớp câu hỏi (+ tiêu đề tài liệu của nhóm)
  private async gather(communityId: string, question: string): Promise<{ block: string; sources: CommunityAskSource[] }> {
    const tsq = toTsQuery(question)
    const [posts, chunks, docs] = await Promise.all([
      this.db.query(
        `(SELECT p.id, p.title, p.content, 0 AS rank FROM community_pins cp JOIN posts p ON p.id = cp.post_id
           WHERE cp.community_id = $1 AND p.hidden_at IS NULL AND NOT p.is_anonymous)
         UNION ALL
         (SELECT p.id, p.title, p.content, 1 AS rank FROM posts p
           WHERE p.community_id = $1 AND p.hidden_at IS NULL AND NOT p.is_anonymous AND $2 <> '' AND p.search_tsv @@ to_tsquery('simple', $2)
           ORDER BY p.created_at DESC LIMIT 6)
         UNION ALL
         (SELECT p.id, p.title, p.content, 2 AS rank FROM posts p
           WHERE p.community_id = $1 AND p.hidden_at IS NULL AND NOT p.is_anonymous ORDER BY p.created_at DESC LIMIT 5)`,
        [communityId, tsq]
      ),
      tsq
        ? this.db.query(
            `SELECT d.id, d.title, ch.heading, ch.content_text
               FROM document_chunks ch JOIN documents d ON d.id = ch.document_id
               JOIN community_documents cd ON cd.document_id = d.id AND cd.community_id = $1
              WHERE d.status = 'published' AND d.visibility = 'public' AND ch.search_tsv @@ to_tsquery('simple', $2)
              ORDER BY ts_rank(ch.search_tsv, to_tsquery('simple', $2)) DESC LIMIT 6`,
            [communityId, tsq]
          )
        : Promise.resolve({ rows: [] as any[] }),
      this.db.query(
        `SELECT d.id, d.title, d.description FROM community_documents cd JOIN documents d ON d.id = cd.document_id
          WHERE cd.community_id = $1 AND d.status = 'published' AND d.visibility = 'public' ORDER BY cd.added_at DESC LIMIT 10`,
        [communityId]
      )
    ])

    const sources: CommunityAskSource[] = []
    const lines: string[] = []
    const seenPost = new Set<string>()
    for (const r of posts.rows.sort((a, b) => a.rank - b.rank)) {
      if (seenPost.has(r.id)) continue
      seenPost.add(r.id)
      const index = sources.length + 1
      sources.push({ index, type: 'post', id: r.id, title: r.title || clip(String(r.content).replace(/\s+/g, ' '), 60) })
      lines.push(`[${index}] (bài viết) ${r.title ? `${r.title}\n` : ''}${clip(String(r.content), 500)}`)
    }
    const docIndex = new Map<string, number>()
    for (const r of chunks.rows) {
      let index = docIndex.get(r.id)
      if (!index) {
        index = sources.length + 1
        docIndex.set(r.id, index)
        sources.push({ index, type: 'document', id: r.id, title: r.title })
      }
      lines.push(`[${index}] (tài liệu "${r.title}"${r.heading ? ` · ${r.heading}` : ''}) ${clip(String(r.content_text), 600)}`)
    }
    for (const r of docs.rows) {
      if (docIndex.has(r.id)) continue
      const index = sources.length + 1
      docIndex.set(r.id, index)
      sources.push({ index, type: 'document', id: r.id, title: r.title })
      lines.push(`[${index}] (tài liệu "${r.title}") ${r.description ? clip(String(r.description), 300) : 'Không có mô tả'}`)
    }
    return { block: lines.join('\n\n'), sources }
  }
}
