import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { randomBytes } from 'crypto'
import type { AiThreadShare, ChatCitation, SharedAiMessage, SharedAiThread } from '@pu/schemas'
import { DatabaseService } from '../../../database/database.service'

// Tin đưa vào link: hoàn tất, chưa thu hồi, không phải tin hệ thống ("Chủ đề mới")
const SHARED_MESSAGE = `m.deleted_at IS NULL AND m.status = 'done' AND m.kind <> 'system'`
const MAX_SHARED_MESSAGES = 500
const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/

// Chia sẻ công khai 1 thread N7AI: link = ảnh chụp tới tin cuối lúc tạo / cập nhật (until_message_id)
// Chủ thread tạo / cập nhật / ngắt; ai có link đều xem được (không cần đăng nhập)
@Injectable()
export class AiThreadShareService {
  constructor(private readonly db: DatabaseService) {}

  // Trạng thái chia sẻ của thread mình (null = chưa chia sẻ)
  async get(userId: string, conversationId: string): Promise<AiThreadShare | null> {
    await this.assertOwner(userId, conversationId)
    return this.load(conversationId)
  }

  // Tạo link (lần đầu) hoặc cập nhật ảnh chụp tới tin mới nhất — giữ nguyên token
  async share(userId: string, conversationId: string): Promise<AiThreadShare> {
    await this.assertOwner(userId, conversationId)
    const res = await this.db.query(
      `INSERT INTO ai_thread_shares (conversation_id, owner_id, token, until_message_id)
       SELECT $1, $2, $3, max(m.id) FROM messages m WHERE m.conversation_id = $1 AND ${SHARED_MESSAGE}
       HAVING max(m.id) IS NOT NULL
       ON CONFLICT (conversation_id) DO UPDATE SET until_message_id = EXCLUDED.until_message_id, updated_at = NOW()
       RETURNING conversation_id`,
      [conversationId, userId, randomBytes(16).toString('base64url')]
    )
    if (!res.rows[0]) throw new BadRequestException('Cuộc trò chuyện chưa có tin nhắn để chia sẻ')
    return (await this.load(conversationId))!
  }

  // Ngắt chia sẻ ⇒ link cũ hết hiệu lực ngay
  async unshare(userId: string, conversationId: string): Promise<{ shared: false }> {
    await this.assertOwner(userId, conversationId)
    await this.db.query(`DELETE FROM ai_thread_shares WHERE conversation_id = $1`, [conversationId])
    return { shared: false }
  }

  // Trang công khai: tiêu đề + tin trong ảnh chụp; tệp đính kèm & nguồn riêng tư không lộ
  async view(token: string): Promise<SharedAiThread> {
    if (!TOKEN_RE.test(token)) throw new NotFoundException('Link chia sẻ không tồn tại hoặc đã bị gỡ')
    const share = await this.db.query(
      `SELECT s.conversation_id, s.until_message_id, s.updated_at, c.title
       FROM ai_thread_shares s JOIN conversations c ON c.id = s.conversation_id WHERE s.token = $1`,
      [token]
    )
    const s = share.rows[0]
    if (!s) throw new NotFoundException('Link chia sẻ không tồn tại hoặc đã bị gỡ')
    const res = await this.db.query(
      `SELECT m.id, m.kind, m.content, m.blocks, m.meta->>'aiMode' AS ai_mode,
              COALESCE(jsonb_array_length(m.attachments), 0) AS attachment_count, m.created_at
       FROM messages m
       WHERE m.conversation_id = $1 AND m.id <= $2 AND ${SHARED_MESSAGE}
       ORDER BY m.id LIMIT $3`,
      [s.conversation_id, s.until_message_id, MAX_SHARED_MESSAGES]
    )
    const publicPosts = await this.publicPostIds(res.rows.flatMap((r) => citationsOf(r.blocks).filter((c) => c.ref.type === 'post').map((c) => c.ref.id)))
    const messages: SharedAiMessage[] = res.rows.map((r) => ({
      id: String(r.id),
      role: r.kind === 'ai' ? 'ai' : 'user',
      content: r.content || '',
      aiMode: r.ai_mode ?? null,
      // Drive / Calendar / tài liệu có thể riêng tư ⇒ chỉ giữ bài công khai & trang web
      citations: citationsOf(r.blocks).filter((c) => c.ref.type === 'web' || (c.ref.type === 'post' && publicPosts.has(c.ref.id))),
      attachmentCount: Number(r.attachment_count),
      createdAt: new Date(r.created_at).toISOString()
    }))
    return { title: s.title, sharedAt: new Date(s.updated_at).toISOString(), messages }
  }

  private async load(conversationId: string): Promise<AiThreadShare | null> {
    const res = await this.db.query(
      `SELECT s.token, s.updated_at,
              (SELECT count(*) FROM messages m WHERE m.conversation_id = s.conversation_id AND m.id <= s.until_message_id AND ${SHARED_MESSAGE}) AS message_count,
              EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = s.conversation_id AND m.id > s.until_message_id AND ${SHARED_MESSAGE}) AS has_newer
       FROM ai_thread_shares s WHERE s.conversation_id = $1`,
      [conversationId]
    )
    const r = res.rows[0]
    if (!r) return null
    return { token: r.token, sharedAt: new Date(r.updated_at).toISOString(), messageCount: Number(r.message_count), hasNewer: r.has_newer }
  }

  private async assertOwner(userId: string, conversationId: string) {
    const res = await this.db.query(`SELECT 1 FROM conversations WHERE id = $1 AND type = 'ai' AND created_by = $2`, [conversationId, userId])
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy hội thoại')
  }

  private async publicPostIds(ids: string[]): Promise<Set<string>> {
    const uuids = [...new Set(ids)].filter((id) => /^[0-9a-f-]{36}$/i.test(id))
    if (!uuids.length) return new Set()
    const res = await this.db.query(`SELECT id FROM posts WHERE id = ANY($1::uuid[]) AND visibility = 'public' AND hidden_at IS NULL`, [uuids])
    return new Set(res.rows.map((r) => String(r.id)))
  }
}

const citationsOf = (blocks: unknown): ChatCitation[] =>
  Array.isArray(blocks) ? blocks.filter((b): b is ChatCitation => !!b && typeof b === 'object' && (b as ChatCitation).type === 'citation') : []
