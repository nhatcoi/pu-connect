import { BadRequestException, Injectable } from '@nestjs/common'
import type { ChatRef, ChatRefSuggestion, ChatRefType, SendMessageInput } from '@pu/schemas'
import type { Source } from '../../ai/ai.retrieval'
import { ChatCoreService, type Queryable } from '../chat-core.service'

const SUGGEST_PER_TYPE = 4
const REF_BUDGET = 16_000 // tổng ký tự ngữ cảnh ghim / lượt hỏi
const THREAD_FALLBACK = 'Cuộc trò chuyện PU AI'

const MY_GROUP_COURSES = `SELECT sg.course_id FROM study_group_members gm JOIN study_groups sg ON sg.id = gm.group_id WHERE gm.user_id = $1`

const ALIAS: Record<ChatRefType, string> = { course: 'co', document: 'd', post: 'p', thread: 'c' }

// Quyền xem từng loại ref (alias theo bảng; $U = người xem)
const VISIBLE = {
  document: (u: string) => `(d.visibility = 'public' OR d.owner_id = ${u})`,
  post: (u: string) => `(p.hidden_at IS NULL AND (p.visibility = 'public' OR p.author_id = ${u}))`,
  thread: (u: string) => `(c.type = 'ai' AND c.created_by = ${u})`
}

// Ngữ cảnh gắn vào tin (học phần, tài liệu, bài viết, hội thoại PU AI của mình)
// Kiểm quyền khi gửi · gợi ý cho ô soạn · nạp nội dung cho PU AI
@Injectable()
export class ChatRefsService {
  constructor(private readonly core: ChatCoreService) {}

  // Gọi trong transaction gửi tin: ref nào không xem được ⇒ từ chối cả tin (giữ đúng thứ tự gửi lên)
  async resolve(client: Queryable, userId: string, refs: SendMessageInput['refs'], allowThreads: boolean): Promise<ChatRef[]> {
    if (!refs?.length) return []
    const unique = [...new Map(refs.map((r) => [`${r.type}:${r.id}`, r])).values()]
    if (!allowThreads && unique.some((r) => r.type === 'thread')) throw new BadRequestException('Chỉ gắn hội thoại PU AI khi hỏi PU AI')
    const ids = (t: ChatRefType) => unique.filter((r) => r.type === t).map((r) => r.id)
    const res = await client.query(
      `SELECT 'course' AS type, id, name AS title, code FROM courses WHERE id = ANY($1::uuid[])
       UNION ALL
       SELECT 'document', d.id, d.title, NULL FROM documents d WHERE d.id = ANY($2::uuid[]) AND ${VISIBLE.document('$5')}
       UNION ALL
       SELECT 'post', p.id, COALESCE(NULLIF(p.title, ''), left(p.content, 80)), NULL FROM posts p WHERE p.id = ANY($3::uuid[]) AND ${VISIBLE.post('$5')}
       UNION ALL
       SELECT 'thread', c.id, COALESCE(c.title, '${THREAD_FALLBACK}'), NULL FROM conversations c WHERE c.id = ANY($4::uuid[]) AND ${VISIBLE.thread('$5')}`,
      [ids('course'), ids('document'), ids('post'), ids('thread'), userId]
    )
    const found = new Map<string, ChatRef>(
      res.rows.map((r) => [`${r.type}:${r.id}`, { type: r.type, id: r.id, title: r.title, ...(r.code ? { code: r.code } : {}) }])
    )
    if (found.size !== unique.length) throw new BadRequestException('Ngữ cảnh không tồn tại hoặc bạn không có quyền xem')
    return unique.map((r) => found.get(`${r.type}:${r.id}`)!)
  }

  // Gợi ý cho "@" / "+ Ngữ cảnh": 1 truy vấn UNION ALL, ≤ 4 mỗi loại
  // q rỗng ⇒ gần đây của mình (thread mới nhất, tài liệu của mình, môn của nhóm học, bài đã lưu)
  async suggest(userId: string, q: string, types: ChatRefType[]): Promise<ChatRefSuggestion[]> {
    const term = q
      .trim()
      .toLowerCase()
      .replace(/[%_\\]/g, (c) => `\\${c}`)
    const like = (col: string) => `immutable_unaccent(lower(${col})) LIKE '%' || immutable_unaccent($2) || '%'`
    // Mọi nhánh cùng tên cột (nhánh đầu UNION quyết định tên)
    const cols = (type: ChatRefType, title: string, subtitle = 'NULL', code = 'NULL') =>
      `SELECT '${type}' AS type, ${ALIAS[type]}.id AS id, ${title} AS title, ${subtitle} AS subtitle, ${code} AS code`
    const branches: Record<ChatRefType, string> = {
      thread: `${cols('thread', 'c.title')} FROM conversations c
         WHERE ${VISIBLE.thread('$1')} AND c.title IS NOT NULL ${term ? `AND ${like('c.title')}` : ''}
         ORDER BY COALESCE(c.last_message_at, c.created_at) DESC LIMIT ${SUGGEST_PER_TYPE}`,
      // Môn của nhóm học mình lên trước
      course: `${cols('course', 'co.name', 'co.code', 'co.code')} FROM courses co
         WHERE ${term ? `(${like('co.name')} OR ${like('co.code')})` : `co.id IN (${MY_GROUP_COURSES})`}
         ORDER BY (co.id IN (${MY_GROUP_COURSES})) DESC, co.post_count DESC LIMIT ${SUGGEST_PER_TYPE}`,
      document: term
        ? `${cols('document', 'd.title', 'upper(d.type)')} FROM documents d
           WHERE ${VISIBLE.document('$1')} AND ${like('d.title')} ORDER BY (d.owner_id = $1) DESC, d.download_count DESC LIMIT ${SUGGEST_PER_TYPE}`
        : `${cols('document', 'd.title', 'upper(d.type)')} FROM documents d
           WHERE d.owner_id = $1 ORDER BY d.created_at DESC LIMIT ${SUGGEST_PER_TYPE}`,
      post: term
        ? `${cols('post', 'p.title')} FROM posts p
           WHERE ${VISIBLE.post('$1')} AND p.title <> '' AND ${like('p.title')} ORDER BY p.likes_count DESC LIMIT ${SUGGEST_PER_TYPE}`
        : `${cols('post', 'p.title')} FROM saved_posts s JOIN posts p ON p.id = s.post_id
           WHERE s.user_id = $1 AND p.title <> '' AND ${VISIBLE.post('$1')} ORDER BY s.saved_at DESC LIMIT ${SUGGEST_PER_TYPE}`
    }
    const sql = [...new Set(types)].map((t) => `(${branches[t]})`).join(' UNION ALL ')
    const res = await this.core.db.query(sql, term ? [userId, term] : [userId])
    return res.rows.map((r) => ({ type: r.type, id: r.id, title: r.title, subtitle: r.subtitle, ...(r.code ? { code: r.code } : {}) }))
  }

  // Nội dung ref cho PU AI (ghim trước nguồn truy xuất); chia đều ngân sách ký tự
  async sources(userId: string, refs: ChatRef[]): Promise<Source[]> {
    if (!refs.length) return []
    const per = Math.floor(REF_BUDGET / refs.length)
    const ids = (t: ChatRefType) => refs.filter((r) => r.type === t).map((r) => r.id)
    const db = this.core.db
    const run = (t: ChatRefType, sql: string) => (ids(t).length ? db.query(sql, [ids(t), userId, per]).then((r) => r.rows) : Promise.resolve([]))

    const [courses, documents, posts, threads] = await Promise.all([
      run(
        'course',
        `SELECT co.id, co.code || ' — ' || co.name AS title,
                left(concat_ws(E'\\n', 'Học phần ' || co.code || ' — ' || co.name || ' (' || co.credits || ' tín chỉ)', co.description,
                  'Tài liệu: ' || (SELECT string_agg(d.title, '; ') FROM (SELECT title FROM documents WHERE course_id = co.id AND visibility = 'public' ORDER BY download_count DESC LIMIT 8) d)), $3) AS body
         FROM courses co WHERE co.id = ANY($1::uuid[])`
      ),
      run(
        'document',
        `SELECT d.id, d.title,
                left(concat_ws(E'\\n\\n', d.description,
                  (SELECT string_agg(x.content_text, E'\\n' ORDER BY x.chunk_index) FROM (SELECT content_text, chunk_index FROM document_chunks WHERE document_id = d.id ORDER BY chunk_index LIMIT 12) x)), $3) AS body
         FROM documents d WHERE d.id = ANY($1::uuid[]) AND ${VISIBLE.document('$2')}`
      ),
      run(
        'post',
        `SELECT p.id, COALESCE(NULLIF(p.title, ''), left(p.content, 80)) AS title,
                left(concat_ws(E'\\n\\n', p.content, '[Lời giải đã được tác giả duyệt]' || E'\\n' || (SELECT c.content FROM comments c WHERE c.post_id = p.id AND c.is_solution LIMIT 1)), $3) AS body
         FROM posts p WHERE p.id = ANY($1::uuid[]) AND ${VISIBLE.post('$2')}`
      ),
      run(
        'thread',
        `SELECT c.id, COALESCE(c.title, '${THREAD_FALLBACK}') AS title,
                left(concat_ws(E'\\n\\n', 'Tóm tắt: ' || c.ai_summary,
                  (SELECT string_agg(CASE WHEN m.kind = 'ai' THEN 'PU AI: ' ELSE 'Người dùng: ' END || left(m.content, 400), E'\\n' ORDER BY m.id)
                   FROM (SELECT id, kind, content FROM messages WHERE conversation_id = c.id AND kind <> 'system' AND deleted_at IS NULL AND status = 'done'
                         ORDER BY id DESC LIMIT 10) m)), $3) AS body
         FROM conversations c WHERE c.id = ANY($1::uuid[]) AND ${VISIBLE.thread('$2')}`
      )
    ])
    const byKey = new Map<string, Source>()
    const add = (type: Source['type'], rows: any[]) => rows.forEach((r) => byKey.set(`${type}:${r.id}`, { type, id: r.id, title: r.title, body: r.body || '' }))
    add('course', courses)
    add('document', documents)
    add('post', posts)
    add('thread', threads)
    return refs.map((r) => byKey.get(`${r.type}:${r.id}`)).filter((s): s is Source => !!s)
  }
}
