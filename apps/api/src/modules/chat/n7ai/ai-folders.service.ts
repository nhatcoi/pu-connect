import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { AiFolder } from '@pu/schemas'
import { DatabaseService } from '../../../database/database.service'

const AI_FOLDER_LIMIT = 50 // thư mục / người

const mapFolder = (r: any): AiFolder => ({ id: r.id, name: r.name, threadCount: r.thread_count ?? 0 })

// Thư mục gom thread N7AI của từng người (xóa thư mục ⇒ thread về Lịch sử, ON DELETE SET NULL)
@Injectable()
export class AiFoldersService {
  constructor(private readonly db: DatabaseService) {}

  // Thư mục + số thread đã có tin (khớp danh sách Lịch sử)
  async list(userId: string): Promise<AiFolder[]> {
    const res = await this.db.query(
      `SELECT f.id, f.name,
              (SELECT COUNT(*)::int FROM conversations c WHERE c.ai_folder_id = f.id AND c.last_message_id IS NOT NULL) AS thread_count
       FROM ai_folders f WHERE f.user_id = $1 ORDER BY f.created_at`,
      [userId]
    )
    return res.rows.map(mapFolder)
  }

  async create(userId: string, name: string): Promise<AiFolder> {
    const res = await this.db.query(
      `INSERT INTO ai_folders (user_id, name)
       SELECT $1, $2 WHERE (SELECT COUNT(*) FROM ai_folders WHERE user_id = $1) < $3
       RETURNING id, name`,
      [userId, name, AI_FOLDER_LIMIT]
    )
    if (!res.rows[0]) throw new BadRequestException(`Tối đa ${AI_FOLDER_LIMIT} thư mục`)
    return mapFolder(res.rows[0])
  }

  async rename(userId: string, id: string, name: string): Promise<AiFolder> {
    const res = await this.db.query(`UPDATE ai_folders SET name = $3, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id, name`, [id, userId, name])
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy thư mục')
    return mapFolder(res.rows[0])
  }

  async remove(userId: string, id: string): Promise<{ deleted: boolean }> {
    const res = await this.db.query(`DELETE FROM ai_folders WHERE id = $1 AND user_id = $2`, [id, userId])
    if (!res.rowCount) throw new NotFoundException('Không tìm thấy thư mục')
    return { deleted: true }
  }
}
