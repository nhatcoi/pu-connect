import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { LibraryFolder, LibraryItem, LibraryPage } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { ATTACHED_DOCUMENT_COLUMNS, toAttachedDocument } from './attached-document.sql'
import { DocumentsService } from './documents.service'

const PAGE_SIZE = 24
const MAX_FOLDERS = 50

// Tài liệu người xem được lưu: của chính mình hoặc công khai đã đăng (bản nháp không lưu được)
const SAVABLE = `d.status = 'published' AND (d.owner_id = $1 OR d.visibility = 'public')`

export type LibraryQuery = { scope: 'saved' | 'mine'; folder?: string; q?: string; cursor?: string }

// Kho cá nhân (Domain tài liệu đợt 3): lưu tham chiếu tài liệu từ bài / bình luận / kho môn học, chia thư mục,
// tải tệp riêng (tài liệu riêng tư, không vào kho môn học)
@Injectable()
export class LibraryService {
  constructor(
    private readonly db: DatabaseService,
    private readonly documents: DocumentsService
  ) {}

  async list(userId: string, query: LibraryQuery): Promise<LibraryPage> {
    const params: unknown[] = [userId]
    const where: string[] = []
    const [cursorAt, cursorId] = (query.cursor ?? '').split('_')
    const mine = query.scope === 'mine'
    // saved: theo thời điểm lưu; mine: theo thời điểm đăng
    const at = mine ? 'd.created_at' : 'li.created_at'
    const joins = `LEFT JOIN courses c ON c.id = d.course_id JOIN users u ON u.id = d.owner_id`
    const from = mine
      ? `FROM documents d LEFT JOIN library_items li ON li.document_id = d.id AND li.owner_id = $1 ${joins} WHERE d.owner_id = $1 AND d.status = 'published'`
      : `FROM library_items li JOIN documents d ON d.id = li.document_id ${joins} WHERE li.owner_id = $1 AND ${SAVABLE}`
    if (query.folder === 'none') where.push('li.folder_id IS NULL')
    else if (query.folder && /^[0-9a-f-]{36}$/i.test(query.folder)) {
      params.push(query.folder)
      where.push(`li.folder_id = $${params.length}`)
    }
    if (query.q?.trim()) {
      params.push(`%${query.q.trim()}%`)
      where.push(`(d.title ILIKE $${params.length} OR d.original_name ILIKE $${params.length})`)
    }
    if (cursorAt && cursorId && !Number.isNaN(Date.parse(cursorAt))) {
      params.push(cursorAt, cursorId)
      where.push(`(${at}, d.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`)
    }
    const res = await this.db.query(
      `SELECT ${ATTACHED_DOCUMENT_COLUMNS}, d.owner_id, u.display_name AS owner_name, li.folder_id, ${at} AS saved_at
       ${from}
       ${where.map((w) => ` AND ${w}`).join('')}
       ORDER BY ${at} DESC, d.id DESC LIMIT ${PAGE_SIZE + 1}`,
      params
    )
    const rows = res.rows.slice(0, PAGE_SIZE)
    const last = rows[rows.length - 1]
    return {
      data: rows.map((r) => this.toItem(r, userId)),
      nextCursor: res.rows.length > PAGE_SIZE && last ? `${new Date(last.saved_at).toISOString()}_${last.id}` : null
    }
  }

  // Id tài liệu đã lưu (web đánh dấu nút "Lưu" trên thẻ tài liệu)
  async savedIds(userId: string): Promise<string[]> {
    const res = await this.db.query(`SELECT document_id FROM library_items WHERE owner_id = $1`, [userId])
    return res.rows.map((r) => r.document_id)
  }

  async save(userId: string, documentId: string, folderId?: string | null): Promise<LibraryItem> {
    const doc = await this.db.query(`SELECT 1 FROM documents d WHERE d.id = $2 AND ${SAVABLE}`, [userId, documentId])
    if (!doc.rowCount) throw new NotFoundException('Tài liệu không tồn tại hoặc không lưu được')
    if (folderId) await this.assertFolder(userId, folderId)
    await this.db.query(
      `INSERT INTO library_items (owner_id, document_id, folder_id) VALUES ($1, $2, $3)
       ON CONFLICT (owner_id, document_id) DO UPDATE SET folder_id = COALESCE(EXCLUDED.folder_id, library_items.folder_id)`,
      [userId, documentId, folderId ?? null]
    )
    return this.item(userId, documentId)
  }

  async move(userId: string, documentId: string, folderId: string | null): Promise<LibraryItem> {
    if (folderId) await this.assertFolder(userId, folderId)
    const res = await this.db.query(`UPDATE library_items SET folder_id = $3 WHERE owner_id = $1 AND document_id = $2`, [userId, documentId, folderId])
    if (!res.rowCount) throw new NotFoundException('Tài liệu chưa có trong kho của bạn')
    return this.item(userId, documentId)
  }

  async remove(userId: string, documentId: string): Promise<{ removed: boolean }> {
    const res = await this.db.query(`DELETE FROM library_items WHERE owner_id = $1 AND document_id = $2`, [userId, documentId])
    return { removed: !!res.rowCount }
  }

  // Tải tệp riêng vào kho: tài liệu riêng tư đã đăng (không hết hạn như bản nháp), lưu luôn vào kho
  async upload(userId: string, file: Express.Multer.File, folderId?: string | null) {
    if (folderId) await this.assertFolder(userId, folderId)
    const { document, duplicateOf } = await this.documents.upload(userId, file)
    await this.db.query(`UPDATE documents SET status = 'published', updated_at = NOW() WHERE id = $1`, [document.id])
    await this.db.query(`INSERT INTO library_items (owner_id, document_id, folder_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [
      userId,
      document.id,
      folderId ?? null
    ])
    return { item: await this.item(userId, document.id), duplicateOf }
  }

  async folders(userId: string): Promise<LibraryFolder[]> {
    const res = await this.db.query(
      `SELECT f.id, f.name, f.created_at,
              (SELECT count(*)::int FROM library_items li JOIN documents d ON d.id = li.document_id
                WHERE li.folder_id = f.id AND ${SAVABLE}) AS item_count
       FROM library_folders f WHERE f.owner_id = $1 ORDER BY lower(f.name)`,
      [userId]
    )
    return res.rows.map((r) => ({ id: r.id, name: r.name, itemCount: r.item_count, createdAt: new Date(r.created_at).toISOString() }))
  }

  async createFolder(userId: string, name: string): Promise<LibraryFolder> {
    const count = await this.db.query(`SELECT count(*)::int AS n FROM library_folders WHERE owner_id = $1`, [userId])
    if (count.rows[0].n >= MAX_FOLDERS) throw new BadRequestException(`Tối đa ${MAX_FOLDERS} thư mục`)
    try {
      const res = await this.db.query(`INSERT INTO library_folders (owner_id, name) VALUES ($1, $2) RETURNING id, name, created_at`, [userId, name])
      const r = res.rows[0]
      return { id: r.id, name: r.name, itemCount: 0, createdAt: new Date(r.created_at).toISOString() }
    } catch (err: any) {
      if (err?.code === '23505') throw new ConflictException('Đã có thư mục cùng tên')
      throw err
    }
  }

  async renameFolder(userId: string, id: string, name: string): Promise<{ id: string; name: string }> {
    try {
      const res = await this.db.query(`UPDATE library_folders SET name = $3 WHERE id = $2 AND owner_id = $1 RETURNING id, name`, [userId, id, name])
      if (!res.rowCount) throw new NotFoundException('Thư mục không tồn tại')
      return res.rows[0]
    } catch (err: any) {
      if (err?.code === '23505') throw new ConflictException('Đã có thư mục cùng tên')
      throw err
    }
  }

  // Xóa thư mục: tài liệu trong đó về "Chưa phân thư mục" (FK ON DELETE SET NULL)
  async deleteFolder(userId: string, id: string): Promise<{ deleted: boolean }> {
    const res = await this.db.query(`DELETE FROM library_folders WHERE id = $2 AND owner_id = $1`, [userId, id])
    return { deleted: !!res.rowCount }
  }

  private async assertFolder(userId: string, folderId: string) {
    const res = await this.db.query(`SELECT 1 FROM library_folders WHERE id = $1 AND owner_id = $2`, [folderId, userId])
    if (!res.rowCount) throw new NotFoundException('Thư mục không tồn tại')
  }

  private async item(userId: string, documentId: string): Promise<LibraryItem> {
    const res = await this.db.query(
      `SELECT ${ATTACHED_DOCUMENT_COLUMNS}, d.owner_id, u.display_name AS owner_name, li.folder_id, li.created_at AS saved_at
       FROM library_items li JOIN documents d ON d.id = li.document_id
       LEFT JOIN courses c ON c.id = d.course_id JOIN users u ON u.id = d.owner_id
       WHERE li.owner_id = $1 AND li.document_id = $2`,
      [userId, documentId]
    )
    return this.toItem(res.rows[0], userId)
  }

  private toItem(r: any, userId: string): LibraryItem {
    return {
      document: toAttachedDocument(r),
      folderId: r.folder_id ?? null,
      savedAt: new Date(r.saved_at).toISOString(),
      ownedByMe: r.owner_id === userId,
      ownerName: r.owner_name
    }
  }
}
