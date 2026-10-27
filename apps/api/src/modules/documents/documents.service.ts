import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { createHash } from 'crypto'
import type { AttachedDocument, DocCategory, DocumentDetail, DocumentItem, DocumentListItem, DocumentListPage, DocumentSort, DocumentUploadResult } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { setTrashActor } from '../../database/trash'
import { RagIndexQueue } from '../ai/rag/rag-index.processor'
import { StorageService } from '../storage/storage.service'
import { ATTACHED_DOCUMENT_COLUMNS, formatFromMime, toAttachedDocument } from './attached-document.sql'
import type { CreateDocumentBody } from './dto/documents.dto'
import type { ClassifyDocumentInput } from '@pu/schemas'

const DRAFT_TTL_HOURS = 24
const DRAFT_SWEEP_MS = 60 * 60 * 1000
const BROWSE_PAGE_SIZE = 20

// Cột thẻ danh sách kho chung (alias d, c, u = users người đăng)
const LIST_COLUMNS = `${ATTACHED_DOCUMENT_COLUMNS}, d.owner_id, d.save_count, d.created_at, u.username AS owner_username, u.display_name AS owner_name`

export type BrowseQuery = { course?: string; category?: DocCategory; q?: string; sort?: DocumentSort; cursor?: string }

@Injectable()
export class DocumentsService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout

  constructor(
    private readonly db: DatabaseService,
    private readonly ragIndex: RagIndexQueue,
    private readonly storage: StorageService
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.purgeDrafts().catch(() => undefined), DRAFT_SWEEP_MS)
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
  }

  async findAll(type?: string, search?: string, course?: string): Promise<DocumentItem[]> {
    let sql = `
      SELECT d.*,
             u.id as user_id, u.username as user_username,
             u.display_name as user_display_name, u.avatar_url as user_avatar_url,
             c.code as course_code
      FROM documents d
      JOIN users u ON d.owner_id = u.id
      LEFT JOIN courses c ON d.course_id = c.id
      WHERE d.visibility = 'public' AND d.status = 'published'
    `
    const params: any[] = []

    if (course) {
      params.push(course)
      sql += ` AND d.listed AND (c.code ILIKE $${params.length} OR c.id::text = $${params.length})`
    }

    if (type && type !== 'all') {
      params.push(type)
      sql += ` AND d.type = $${params.length}`
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`)
      sql += ` AND (d.title ILIKE $${params.length} OR d.description ILIKE $${params.length} OR $${params.length} = ANY(d.tags))`
    }

    sql += ` ORDER BY d.download_count DESC, d.created_at DESC LIMIT 50`

    const res = await this.db.query(sql, params)
    return res.rows.map((row) => this.mapRowToDocument(row))
  }

  // Trang "Tài liệu": kho chung (đã vào kho môn học), lọc môn / loại / từ khóa; phân trang offset (sắp theo lượt tải đổi liên tục)
  async browse(query: BrowseQuery): Promise<DocumentListPage> {
    const params: unknown[] = []
    const where = ['d.listed']
    if (query.course) {
      params.push(query.course)
      where.push(`(c.code ILIKE $${params.length} OR c.id::text = $${params.length})`)
    }
    if (query.category) {
      params.push(query.category)
      where.push(`d.doc_type = $${params.length}::doc_type_enum`)
    }
    if (query.q?.trim()) {
      params.push(`%${query.q.trim()}%`)
      where.push(`(d.title ILIKE $${params.length} OR d.description ILIKE $${params.length} OR c.code ILIKE $${params.length} OR c.name ILIKE $${params.length})`)
    }
    const offset = Math.max(0, Math.min(Number.parseInt(query.cursor ?? '0', 10) || 0, 10_000))
    const order = query.sort === 'newest' ? 'd.created_at DESC, d.id DESC' : 'd.download_count + d.save_count * 2 DESC, d.created_at DESC, d.id DESC'
    const res = await this.db.query(
      `SELECT ${LIST_COLUMNS}
       FROM documents d LEFT JOIN courses c ON c.id = d.course_id JOIN users u ON u.id = d.owner_id
       WHERE ${where.join(' AND ')}
       ORDER BY ${order} LIMIT ${BROWSE_PAGE_SIZE + 1} OFFSET ${offset}`,
      params
    )
    return {
      data: res.rows.slice(0, BROWSE_PAGE_SIZE).map(toListItem),
      nextCursor: res.rows.length > BROWSE_PAGE_SIZE ? String(offset + BROWSE_PAGE_SIZE) : null
    }
  }

  // Trang chi tiết: tài liệu công khai đã đăng (hoặc của chính mình) + bài viết có đính kèm + tài liệu cùng môn
  async detail(id: string, viewerId?: string | null): Promise<DocumentDetail> {
    const res = await this.db.query(
      `SELECT ${LIST_COLUMNS}, d.description, d.original_name, d.view_count,
              EXISTS (SELECT 1 FROM library_items li WHERE li.document_id = d.id AND li.owner_id::text = $2) AS is_saved
       FROM documents d LEFT JOIN courses c ON c.id = d.course_id JOIN users u ON u.id = d.owner_id
       WHERE d.id = $1 AND d.status = 'published' AND (d.visibility = 'public' OR d.owner_id::text = $2)`,
      [id, viewerId ?? '']
    )
    const row = res.rows[0]
    if (!row) throw new NotFoundException('Không tìm thấy tài liệu')
    const isMine = row.owner_id === viewerId
    if (!isMine) await this.db.query(`UPDATE documents SET view_count = view_count + 1 WHERE id = $1`, [id])

    const [posts, related] = await Promise.all([
      this.db.query(
        `SELECT p.id, p.title, left(p.content, 160) AS excerpt, p.created_at,
                CASE WHEN p.is_anonymous THEN 'Ẩn danh' ELSE u.display_name END AS author_name
         FROM post_documents pd JOIN posts p ON p.id = pd.post_id JOIN users u ON u.id = p.author_id
         WHERE pd.document_id = $1 AND p.visibility = 'public' AND p.hidden_at IS NULL
         ORDER BY p.created_at DESC LIMIT 5`,
        [id]
      ),
      row.course_id
        ? this.db.query(
            `SELECT ${LIST_COLUMNS}
             FROM documents d LEFT JOIN courses c ON c.id = d.course_id JOIN users u ON u.id = d.owner_id
             WHERE d.listed AND d.course_id = $1 AND d.id <> $2
             ORDER BY (d.doc_type IS NOT DISTINCT FROM $3::doc_type_enum) DESC, d.download_count DESC, d.created_at DESC LIMIT 6`,
            [row.course_id, id, row.doc_type]
          )
        : Promise.resolve({ rows: [] as any[] })
    ])
    return {
      ...toListItem(row),
      description: row.description ?? null,
      originalName: row.original_name ?? null,
      viewCount: (row.view_count || 0) + (isMine ? 0 : 1),
      isMine,
      isSaved: !!row.is_saved,
      posts: posts.rows.map((p) => ({
        id: p.id,
        title: p.title ?? null,
        excerpt: p.excerpt ?? '',
        authorName: p.author_name,
        createdAt: new Date(p.created_at).toISOString()
      })),
      related: related.rows.map(toListItem)
    }
  }

  // Chủ tài liệu xóa tài liệu đã đăng: gỡ khỏi bài / bình luận / kho của mọi người (bản ghi vào thùng rác 30 ngày)
  async remove(id: string, userId: string): Promise<{ deleted: boolean }> {
    return this.db.transaction(async (client) => {
      await setTrashActor(client, userId)
      const res = await client.query(`DELETE FROM documents WHERE id = $1 AND owner_id = $2 RETURNING file_url`, [id, userId])
      if (!res.rowCount) throw new NotFoundException('Tài liệu không tồn tại')
      // Cột URL cũ của bài (đếm tệp đính kèm) bỏ tệp vừa xóa
      await client.query(`UPDATE posts SET attached_document_ids = array_remove(attached_document_ids, $1) WHERE $1 = ANY(attached_document_ids)`, [
        res.rows[0].file_url
      ])
      return { deleted: true }
    })
  }

  // Tài liệu riêng tư / bản nháp: chỉ chủ sở hữu xem được
  async findOne(id: string, viewerId?: string | null): Promise<DocumentItem> {
    const res = await this.db.query(
      `SELECT d.*,
              u.id as user_id, u.username as user_username,
              u.display_name as user_display_name, u.avatar_url as user_avatar_url,
              c.code as course_code
       FROM documents d
       JOIN users u ON d.owner_id = u.id
       LEFT JOIN courses c ON d.course_id = c.id
       WHERE d.id::text = $1 AND ((d.visibility = 'public' AND d.status = 'published') OR d.owner_id::text = $2)
       LIMIT 1`,
      [id, viewerId ?? '']
    )
    if (res.rows.length === 0) {
      throw new NotFoundException(`Không tìm thấy tài liệu (ID: ${id})`)
    }
    if (res.rows[0].owner_id !== viewerId) await this.db.query(`UPDATE documents SET view_count = view_count + 1 WHERE id = $1`, [res.rows[0].id])
    return this.mapRowToDocument(res.rows[0])
  }

  // Tạo tài liệu trực tiếp: chỉ nhận tệp nằm trên R2 của hệ thống (chặn link ngoài / javascript:)
  async create(ownerId: string, data: CreateDocumentBody): Promise<DocumentItem> {
    if (!data.fileUrl.startsWith(this.storage.publicUrlFor('documents/'))) {
      throw new BadRequestException('Tệp phải được tải lên qua PU Connector')
    }
    const listed = data.visibility === 'public' && !!data.courseId && !!data.docCategory
    const insertRes = await this.db.query(
      `INSERT INTO documents (owner_id, course_id, title, description, type, doc_type, file_url, file_size, mime_type, tags, visibility, status, listed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'published', $12)
       RETURNING id`,
      [
        ownerId,
        data.courseId || null,
        data.title,
        data.description || null,
        formatFromMime(data.mimeType),
        data.docCategory || null,
        data.fileUrl,
        data.fileSize,
        data.mimeType,
        data.tags,
        data.visibility,
        listed
      ]
    )
    // Trích nội dung tệp cho N7AI (RAG) ngay, không chờ lịch quét
    this.ragIndex.kick()
    return this.findOne(insertRes.rows[0].id, ownerId)
  }

  // Đính kèm trong lúc soạn bài: tải lên R2 + tạo bản nháp riêng tư; báo tài liệu công khai trùng nội dung (sha256)
  async upload(ownerId: string, file: Express.Multer.File): Promise<DocumentUploadResult> {
    const hash = createHash('sha256').update(file.buffer).digest('hex')
    const up = await this.storage.uploadFile(file.buffer, file.originalname, file.mimetype, 'documents', ownerId)
    const name = file.originalname.slice(0, 255)
    const title = name.replace(/\.[A-Za-z0-9]{1,8}$/, '').replace(/[_]+/g, ' ').trim().slice(0, 200) || name
    const ins = await this.db.query(
      `INSERT INTO documents (owner_id, title, original_name, type, file_url, file_size, mime_type, visibility, status, file_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'private', 'draft', $8)
       RETURNING id`,
      [ownerId, title, name, formatFromMime(file.mimetype), up.url, up.size, file.mimetype, hash]
    )
    const dup = await this.db.query(
      `SELECT d.id, d.title, c.code AS course_code FROM documents d LEFT JOIN courses c ON c.id = d.course_id
        WHERE d.file_hash = $1 AND d.id <> $2 AND d.status = 'published' AND d.visibility = 'public'
        ORDER BY d.listed DESC, d.download_count DESC LIMIT 1`,
      [hash, ins.rows[0].id]
    )
    // Trích nội dung sớm (N7AI gợi ý phân loại, tìm kiếm sau khi đăng)
    this.ragIndex.kick()
    const d = dup.rows[0]
    return {
      document: await this.attached(ins.rows[0].id),
      duplicateOf: d ? { id: d.id, title: d.title, courseCode: d.course_code ?? null } : null
    }
  }

  // Phân loại (chủ tài liệu). Vào kho môn học cần đủ môn + loại và tài liệu không riêng tư sau khi đăng
  async classify(id: string, userId: string, input: ClassifyDocumentInput): Promise<AttachedDocument> {
    const cur = await this.db.query(`SELECT owner_id, course_id, doc_type, status, visibility FROM documents WHERE id = $1`, [id])
    const row = cur.rows[0]
    if (!row) throw new NotFoundException('Tài liệu không tồn tại')
    if (row.owner_id !== userId) throw new ForbiddenException('Chỉ người đăng được phân loại tài liệu')
    const courseId = input.courseId !== undefined ? input.courseId : row.course_id
    const category = input.docCategory !== undefined ? input.docCategory : row.doc_type
    if (input.listed && (!courseId || !category)) throw new BadRequestException('Chọn môn học và loại tài liệu để đưa vào kho')
    if (input.listed && row.status === 'published' && row.visibility !== 'public') throw new BadRequestException('Tài liệu riêng tư không đưa vào kho được')
    if (courseId && input.courseId) {
      const c = await this.db.query(`SELECT 1 FROM courses WHERE id = $1`, [courseId])
      if (!c.rowCount) throw new BadRequestException('Môn học không tồn tại')
    }
    await this.db.query(
      `UPDATE documents SET
         title = COALESCE($2, title),
         course_id = $3::uuid,
         doc_type = ($4::text)::doc_type_enum,
         academic_year = CASE WHEN $5::boolean THEN $6 ELSE academic_year END,
         listed = CASE WHEN $3::uuid IS NULL OR $4::text IS NULL THEN FALSE ELSE COALESCE($7, listed) END,
         updated_at = NOW()
       WHERE id = $1`,
      [id, input.title ?? null, courseId ?? null, category ?? null, input.academicYear !== undefined, input.academicYear ?? null, input.listed ?? null]
    )
    return this.attached(id)
  }

  // Gỡ tệp khỏi bài đang soạn: chỉ xóa bản nháp của chính mình (bản đã đăng giữ nguyên)
  async discardDraft(id: string, userId: string): Promise<{ deleted: boolean }> {
    return this.db.transaction(async (client) => {
      await setTrashActor(client, userId)
      const res = await client.query(`DELETE FROM documents WHERE id = $1 AND owner_id = $2 AND status = 'draft'`, [id, userId])
      return { deleted: !!res.rowCount }
    })
  }

  // Bản nháp bị bỏ (không đăng bài) quá DRAFT_TTL_HOURS ⇒ xóa bản ghi (vào thùng rác) + tệp R2 nếu không bản ghi nào khác dùng
  async purgeDrafts(): Promise<number> {
    const res = await this.db.query(
      `DELETE FROM documents d WHERE d.status = 'draft' AND d.created_at < NOW() - make_interval(hours => $1)
       RETURNING d.file_url, EXISTS (SELECT 1 FROM documents o WHERE o.file_url = d.file_url AND o.id <> d.id) AS shared`,
      [DRAFT_TTL_HOURS]
    )
    const prefix = this.storage.publicUrlFor('')
    const keys = res.rows.filter((r) => !r.shared && r.file_url?.startsWith(prefix)).map((r) => (r.file_url as string).slice(prefix.length))
    if (keys.length) await this.storage.deleteObjects(keys)
    return res.rowCount ?? 0
  }

  private async attached(id: string): Promise<AttachedDocument> {
    const res = await this.db.query(`SELECT ${ATTACHED_DOCUMENT_COLUMNS} FROM documents d LEFT JOIN courses c ON c.id = d.course_id WHERE d.id = $1`, [id])
    return toAttachedDocument(res.rows[0])
  }

  async incrementDownload(id: string): Promise<{ downloadUrl: string }> {
    const res = await this.db.query(`UPDATE documents SET download_count = download_count + 1 WHERE id::text = $1 AND status = 'published' AND visibility = 'public' RETURNING file_url`, [id])
    if (res.rows.length === 0) {
      throw new NotFoundException('Tài liệu không tồn tại')
    }
    return { downloadUrl: res.rows[0].file_url }
  }

  private mapRowToDocument(row: any): DocumentItem {
    return {
      id: row.id,
      ownerId: row.owner_id,
      owner: {
        id: row.user_id || row.owner_id,
        username: row.user_username || 'user',
        displayName: row.user_display_name || 'Sinh viên Phenikaa',
        avatarUrl: row.user_avatar_url || null
      },
      courseId: row.course_id,
      courseCode: row.course_code || (row.tags && row.tags[0]) || null,
      title: row.title,
      description: row.description,
      type: row.type || 'pdf',
      fileUrl: row.file_url,
      fileSize: parseInt(row.file_size, 10) || 1048576,
      mimeType: row.mime_type || 'application/pdf',
      tags: row.tags || [],
      downloadCount: row.download_count || 0,
      viewCount: row.view_count || 0,
      visibility: row.visibility || 'public',
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
    }
  }
}

function toListItem(row: any): DocumentListItem {
  return {
    ...toAttachedDocument(row),
    ownerId: row.owner_id,
    ownerUsername: row.owner_username,
    ownerName: row.owner_name,
    saveCount: row.save_count || 0,
    createdAt: new Date(row.created_at).toISOString()
  }
}
