import { BadRequestException, Injectable } from '@nestjs/common'
import type { PoolClient } from 'pg'
import type { AttachedDocument } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { ATTACHED_DOCUMENT_COLUMNS, toAttachedDocument } from './attached-document.sql'
import { MAX_COMMENT_DOCUMENTS, MAX_POST_DOCUMENTS } from './dto/documents.dto'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Liên kết bài viết / bình luận ↔ tài liệu (post_documents, comment_documents). Chỉ phụ thuộc DB ⇒ PostsModule dùng trực tiếp
@Injectable()
export class PostDocumentsService {
  constructor(private readonly db: DatabaseService) {}

  // Gắn tài liệu vào bài (trong transaction tạo bài). Bản nháp của người đăng: draft → published, quyền xem theo bài.
  // Tài liệu công khai của người khác (chọn "dùng bản đã có trong kho" khi trùng): chỉ liên kết, không đổi gì.
  // Trả id môn của tài liệu đầu tiên có môn (gợi ý môn cho bài chưa gắn môn)
  async attach(client: PoolClient, postId: string, ownerId: string, documentIds: string[], postVisibility: string): Promise<string | null> {
    const docs = await this.publish(client, ownerId, documentIds, MAX_POST_DOCUMENTS, postVisibility)
    if (!docs.length) return null
    await client.query(
      `INSERT INTO post_documents (post_id, document_id, position)
       SELECT $1, d.id, d.pos - 1 FROM unnest($2::uuid[]) WITH ORDINALITY AS d(id, pos) ON CONFLICT DO NOTHING`,
      [postId, docs.map((d) => d.id)]
    )
    // Giữ cột URL cũ để các danh sách chưa đọc post_documents vẫn đếm được tệp đính kèm
    await client.query(`UPDATE posts SET attached_document_ids = $2 WHERE id = $1`, [postId, docs.map((d) => d.file_url)])
    return docs.map((d) => d.course_id).find(Boolean) ?? null
  }

  // Gắn tài liệu vào bình luận (trong transaction tạo bình luận); quyền xem theo bài chứa bình luận
  async attachToComment(client: PoolClient, commentId: string, postId: string, ownerId: string, documentIds: string[]): Promise<void> {
    if (!documentIds.length) return
    const post = await client.query(`SELECT visibility FROM posts WHERE id = $1`, [postId])
    const docs = await this.publish(client, ownerId, documentIds, MAX_COMMENT_DOCUMENTS, post.rows[0]?.visibility ?? 'private')
    if (!docs.length) return
    await client.query(
      `INSERT INTO comment_documents (comment_id, document_id, position)
       SELECT $1, d.id, d.pos - 1 FROM unnest($2::uuid[]) WITH ORDINALITY AS d(id, pos) ON CONFLICT DO NOTHING`,
      [commentId, docs.map((d) => d.id)]
    )
  }

  // Bản nháp của chính mình ⇒ published (riêng tư nếu nơi đăng không công khai); kiểm mọi id đều dùng được. Giữ thứ tự id
  private async publish(client: PoolClient, ownerId: string, documentIds: string[], max: number, visibility: string) {
    const ids = [...new Set(documentIds.filter((id) => UUID_RE.test(id)))].slice(0, max)
    if (!ids.length) return []
    await client.query(
      `UPDATE documents SET status = 'published',
              visibility = CASE WHEN $3 = 'public' THEN 'public' ELSE 'private' END,
              listed = listed AND course_id IS NOT NULL AND doc_type IS NOT NULL AND $3 = 'public',
              updated_at = NOW()
        WHERE id = ANY($1::uuid[]) AND owner_id = $2 AND status = 'draft'`,
      [ids, ownerId, visibility]
    )
    const docs = await client.query(
      `SELECT id, file_url, course_id FROM documents
        WHERE id = ANY($1::uuid[]) AND status = 'published' AND (owner_id = $2 OR visibility = 'public')`,
      [ids, ownerId]
    )
    if (docs.rowCount !== ids.length) throw new BadRequestException('Tài liệu đính kèm không hợp lệ hoặc không còn tồn tại')
    const byId = new Map(docs.rows.map((r) => [r.id as string, r as { id: string; file_url: string; course_id: string | null }]))
    return ids.map((id) => byId.get(id)!)
  }

  // Thẻ tài liệu cho nhiều bài (1 truy vấn)
  async forPosts(postIds: string[], client?: PoolClient): Promise<Map<string, AttachedDocument[]>> {
    const map = new Map<string, AttachedDocument[]>()
    if (!postIds.length) return map
    const run = (sql: string, params: unknown[]) => (client ? client.query(sql, params) : this.db.query(sql, params))
    const res = await run(
      `SELECT pd.post_id, ${ATTACHED_DOCUMENT_COLUMNS}
         FROM post_documents pd JOIN documents d ON d.id = pd.document_id LEFT JOIN courses c ON c.id = d.course_id
        WHERE pd.post_id = ANY($1::uuid[])
        ORDER BY pd.post_id, pd.position`,
      [postIds]
    )
    for (const r of res.rows) map.set(r.post_id, [...(map.get(r.post_id) ?? []), toAttachedDocument(r)])
    return map
  }

  // Thẻ tài liệu cho nhiều bình luận (1 truy vấn); tài liệu đã chuyển riêng tư chỉ chủ thấy
  async forComments(commentIds: string[], viewerId?: string | null, client?: PoolClient): Promise<Map<string, AttachedDocument[]>> {
    const map = new Map<string, AttachedDocument[]>()
    if (!commentIds.length) return map
    const run = (sql: string, params: unknown[]) => (client ? client.query(sql, params) : this.db.query(sql, params))
    const res = await run(
      `SELECT cd.comment_id, ${ATTACHED_DOCUMENT_COLUMNS}
         FROM comment_documents cd JOIN documents d ON d.id = cd.document_id LEFT JOIN courses c ON c.id = d.course_id
        WHERE cd.comment_id = ANY($1::uuid[]) AND (d.visibility = 'public' OR d.owner_id::text = $2)
        ORDER BY cd.comment_id, cd.position`,
      [commentIds, viewerId ?? '']
    )
    for (const r of res.rows) map.set(r.comment_id, [...(map.get(r.comment_id) ?? []), toAttachedDocument(r)])
    return map
  }
}
