import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { CollectionMembership, DocumentCollection, DocumentCollectionDetail, DocumentListItem } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { ATTACHED_DOCUMENT_COLUMNS, toAttachedDocument } from './attached-document.sql'
import type { CollectionBody } from './dto/documents.dto'

const PAGE_SIZE = 20
const MAX_COLLECTIONS_PER_USER = 50
const MAX_ITEMS_PER_COLLECTION = 200
const COVER_COUNT = 3

// Tài liệu người xem được: đã đăng và công khai (hoặc của chính mình); $1 = id người xem ('' khi khách)
const VISIBLE_DOC = `d.status = 'published' AND (d.visibility = 'public' OR d.owner_id::text = $1)`

type CollectionRow = {
  id: string
  owner_id: string
  title: string
  description: string | null
  visibility: 'public' | 'private'
  created_at: Date
  updated_at: Date
  owner_name: string
  owner_username: string
  item_count: number
}

// Bộ sưu tập tài liệu: người dùng gom tài liệu công khai thành bộ, chia sẻ (public) hoặc giữ riêng (private)
@Injectable()
export class CollectionsService {
  constructor(private readonly db: DatabaseService) {}

  // scope=public: bộ công khai có tài liệu (mới cập nhật trước); scope=mine: bộ của mình
  async list(viewerId: string | null, scope: 'mine' | 'public', cursor?: string): Promise<{ data: DocumentCollection[]; nextCursor: string | null }> {
    if (scope === 'mine' && !viewerId) throw new ForbiddenException('Cần đăng nhập')
    const offset = Math.max(0, Math.min(Number.parseInt(cursor ?? '0', 10) || 0, 10_000))
    const res = await this.db.query(
      `SELECT * FROM (${this.selectCollections()}
        WHERE ${scope === 'mine' ? 'k.owner_id::text = $1' : `k.visibility = 'public'`}) t
       ${scope === 'public' ? 'WHERE t.item_count > 0' : ''}
       ORDER BY t.updated_at DESC, t.id LIMIT ${PAGE_SIZE + 1} OFFSET ${offset}`,
      [viewerId ?? '']
    )
    const rows = (res.rows as CollectionRow[]).slice(0, PAGE_SIZE)
    return { data: await this.withCovers(rows, viewerId), nextCursor: res.rows.length > PAGE_SIZE ? String(offset + PAGE_SIZE) : null }
  }

  // Bộ của mình + đã chứa tài liệu này chưa (menu "Thêm vào bộ sưu tập")
  async membership(userId: string, documentId: string): Promise<CollectionMembership[]> {
    const res = await this.db.query(
      `SELECT k.id, k.title, k.visibility,
              EXISTS (SELECT 1 FROM document_collection_items ci WHERE ci.collection_id = k.id AND ci.document_id = $2) AS has_document
       FROM document_collections k WHERE k.owner_id = $1 ORDER BY k.updated_at DESC`,
      [userId, documentId]
    )
    return res.rows.map((r) => ({ id: r.id, title: r.title, visibility: r.visibility, hasDocument: r.has_document }))
  }

  async detail(id: string, viewerId: string | null): Promise<DocumentCollectionDetail> {
    const row = await this.findVisible(id, viewerId)
    const docs = await this.db.query(
      `SELECT ${ATTACHED_DOCUMENT_COLUMNS}, d.owner_id, d.save_count, d.rating_avg, d.rating_count, d.created_at, u.username AS owner_username, u.display_name AS owner_name
       FROM document_collection_items ci JOIN documents d ON d.id = ci.document_id
       LEFT JOIN courses c ON c.id = d.course_id JOIN users u ON u.id = d.owner_id
       WHERE ci.collection_id = $2 AND ${VISIBLE_DOC}
       ORDER BY ci.added_at DESC`,
      [viewerId ?? '', id]
    )
    const [base] = await this.withCovers([row], viewerId)
    return { ...base, documents: docs.rows.map(toListItem) }
  }

  async create(userId: string, body: CollectionBody): Promise<DocumentCollection> {
    const count = await this.db.query(`SELECT count(*)::int AS n FROM document_collections WHERE owner_id = $1`, [userId])
    if (count.rows[0].n >= MAX_COLLECTIONS_PER_USER) throw new BadRequestException(`Mỗi người tối đa ${MAX_COLLECTIONS_PER_USER} bộ sưu tập`)
    const res = await this.db.query(
      `INSERT INTO document_collections (owner_id, title, description, visibility) VALUES ($1, $2, $3, $4) RETURNING id`,
      [userId, body.title, body.description || null, body.visibility]
    )
    return (await this.detail(res.rows[0].id, userId)) as DocumentCollection
  }

  async update(id: string, userId: string, body: CollectionBody): Promise<DocumentCollection> {
    await this.assertOwner(id, userId)
    await this.db.query(
      `UPDATE document_collections SET title = $2, description = $3, visibility = $4, updated_at = NOW() WHERE id = $1`,
      [id, body.title, body.description || null, body.visibility]
    )
    return this.detail(id, userId)
  }

  async remove(id: string, userId: string): Promise<{ deleted: boolean }> {
    await this.assertOwner(id, userId)
    await this.db.query(`DELETE FROM document_collections WHERE id = $1`, [id])
    return { deleted: true }
  }

  // Thêm tài liệu xem được vào bộ của mình (idempotent)
  async addDocument(id: string, userId: string, documentId: string): Promise<{ added: boolean }> {
    await this.assertOwner(id, userId)
    const doc = await this.db.query(`SELECT 1 FROM documents d WHERE d.id = $2 AND ${VISIBLE_DOC}`, [userId, documentId])
    if (!doc.rows[0]) throw new NotFoundException('Không tìm thấy tài liệu')
    const count = await this.db.query(`SELECT count(*)::int AS n FROM document_collection_items WHERE collection_id = $1`, [id])
    if (count.rows[0].n >= MAX_ITEMS_PER_COLLECTION) throw new BadRequestException(`Mỗi bộ chứa tối đa ${MAX_ITEMS_PER_COLLECTION} tài liệu`)
    await this.db.query(`INSERT INTO document_collection_items (collection_id, document_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, documentId])
    await this.db.query(`UPDATE document_collections SET updated_at = NOW() WHERE id = $1`, [id])
    return { added: true }
  }

  async removeDocument(id: string, userId: string, documentId: string): Promise<{ removed: boolean }> {
    await this.assertOwner(id, userId)
    await this.db.query(`DELETE FROM document_collection_items WHERE collection_id = $1 AND document_id = $2`, [id, documentId])
    await this.db.query(`UPDATE document_collections SET updated_at = NOW() WHERE id = $1`, [id])
    return { removed: true }
  }

  // $1 = id người xem: item_count chỉ đếm tài liệu họ xem được
  private selectCollections() {
    return `SELECT k.id, k.owner_id, k.title, k.description, k.visibility, k.created_at, k.updated_at,
                   u.display_name AS owner_name, u.username AS owner_username,
                   (SELECT count(*)::int FROM document_collection_items ci JOIN documents d ON d.id = ci.document_id
                    WHERE ci.collection_id = k.id AND ${VISIBLE_DOC}) AS item_count
            FROM document_collections k JOIN users u ON u.id = k.owner_id`
  }

  private async findVisible(id: string, viewerId: string | null): Promise<CollectionRow> {
    const res = await this.db.query(`${this.selectCollections()} WHERE k.id = $2 AND (k.visibility = 'public' OR k.owner_id::text = $1)`, [viewerId ?? '', id])
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy bộ sưu tập')
    return res.rows[0]
  }

  private async assertOwner(id: string, userId: string) {
    const res = await this.db.query(`SELECT owner_id FROM document_collections WHERE id = $1`, [id])
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy bộ sưu tập')
    if (res.rows[0].owner_id !== userId) throw new ForbiddenException('Chỉ chủ bộ sưu tập được thay đổi')
  }

  // Ảnh bìa: 3 tài liệu mới thêm nhất mà người xem thấy
  private async withCovers(rows: CollectionRow[], viewerId: string | null): Promise<DocumentCollection[]> {
    const covers = new Map<string, DocumentCollection['covers']>()
    if (rows.length) {
      const res = await this.db.query(
        `SELECT ci.collection_id, ${ATTACHED_DOCUMENT_COLUMNS}
         FROM document_collection_items ci JOIN documents d ON d.id = ci.document_id LEFT JOIN courses c ON c.id = d.course_id
         WHERE ci.collection_id = ANY($2::uuid[]) AND ${VISIBLE_DOC}
         ORDER BY ci.added_at DESC`,
        [viewerId ?? '', rows.map((r) => r.id)]
      )
      for (const r of res.rows) {
        const list = covers.get(r.collection_id) ?? []
        if (list.length < COVER_COUNT) covers.set(r.collection_id, [...list, toAttachedDocument(r)])
      }
    }
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      visibility: r.visibility,
      ownerId: r.owner_id,
      ownerName: r.owner_name,
      ownerUsername: r.owner_username,
      isMine: r.owner_id === viewerId,
      itemCount: r.item_count,
      covers: covers.get(r.id) ?? [],
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString()
    }))
  }
}

function toListItem(row: any): DocumentListItem {
  return {
    ...toAttachedDocument(row),
    ownerId: row.owner_id,
    ownerUsername: row.owner_username,
    ownerName: row.owner_name,
    saveCount: row.save_count || 0,
    ratingAvg: Number(row.rating_avg) || 0,
    ratingCount: row.rating_count || 0,
    createdAt: new Date(row.created_at).toISOString()
  }
}
