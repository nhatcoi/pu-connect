import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { AiSkill, AiSkillDetail, AiSkillInput, ChatSkillRef } from '@pu/schemas'
import { DatabaseService } from '../../../database/database.service'
import type { Queryable } from '../chat-core.service'
import { AI_SKILL_LIMIT } from '../dto/chat.dto'

const LIST_COLUMNS = `id, slug, name, description, input_hint, use_count`

const mapSkill = (r: any): AiSkill => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  description: r.description,
  inputHint: r.input_hint,
  useCount: r.use_count
})

// Skill tự tạo (slash command "/slug"): chỉ dẫn bổ sung cho PU AI, riêng từng người
@Injectable()
export class AiSkillsService {
  constructor(private readonly db: DatabaseService) {}

  // Danh sách nhẹ cho menu "/" (không có instructions), hay dùng lên đầu
  async list(userId: string): Promise<AiSkill[]> {
    const res = await this.db.query(`SELECT ${LIST_COLUMNS} FROM ai_skills WHERE owner_id = $1 ORDER BY last_used_at DESC NULLS LAST, created_at DESC`, [
      userId
    ])
    return res.rows.map(mapSkill)
  }

  async get(userId: string, id: string): Promise<AiSkillDetail> {
    const res = await this.db.query(`SELECT ${LIST_COLUMNS}, instructions FROM ai_skills WHERE id = $1 AND owner_id = $2`, [id, userId])
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy skill')
    return { ...mapSkill(res.rows[0]), instructions: res.rows[0].instructions }
  }

  // Giới hạn số skill kiểm trong cùng câu INSERT (không cần transaction riêng)
  async create(userId: string, input: AiSkillInput): Promise<AiSkillDetail> {
    try {
      const res = await this.db.query(
        `INSERT INTO ai_skills (owner_id, slug, name, description, instructions, input_hint)
         SELECT $1, $2, $3, $4, $5, $6 WHERE (SELECT COUNT(*) FROM ai_skills WHERE owner_id = $1) < $7
         RETURNING ${LIST_COLUMNS}, instructions`,
        [userId, input.slug, input.name, input.description, input.instructions, input.inputHint ?? null, AI_SKILL_LIMIT]
      )
      if (!res.rows[0]) throw new BadRequestException(`Tối đa ${AI_SKILL_LIMIT} skill`)
      return { ...mapSkill(res.rows[0]), instructions: res.rows[0].instructions }
    } catch (err) {
      throw this.duplicate(err)
    }
  }

  async update(userId: string, id: string, input: AiSkillInput): Promise<AiSkillDetail> {
    try {
      const res = await this.db.query(
        `UPDATE ai_skills SET slug = $3, name = $4, description = $5, instructions = $6, input_hint = $7, updated_at = NOW()
         WHERE id = $1 AND owner_id = $2 RETURNING ${LIST_COLUMNS}, instructions`,
        [id, userId, input.slug, input.name, input.description, input.instructions, input.inputHint ?? null]
      )
      if (!res.rows[0]) throw new NotFoundException('Không tìm thấy skill')
      return { ...mapSkill(res.rows[0]), instructions: res.rows[0].instructions }
    } catch (err) {
      throw this.duplicate(err)
    }
  }

  async remove(userId: string, id: string): Promise<{ deleted: boolean }> {
    const res = await this.db.query(`DELETE FROM ai_skills WHERE id = $1 AND owner_id = $2 RETURNING 1`, [id, userId])
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy skill')
    return { deleted: true }
  }

  // Lúc gửi tin: kiểm quyền + đếm lượt dùng trong 1 câu lệnh
  async useForMessage(client: Queryable, userId: string, id: string | undefined): Promise<ChatSkillRef | null> {
    if (!id) return null
    const res = await client.query(
      `UPDATE ai_skills SET use_count = use_count + 1, last_used_at = NOW() WHERE id = $1 AND owner_id = $2 RETURNING id, slug, name`,
      [id, userId]
    )
    if (!res.rows[0]) throw new BadRequestException('Skill không tồn tại')
    return res.rows[0]
  }

  // Chỉ dẫn cho PU AI (skill đã bị xóa giữa chừng ⇒ bỏ qua)
  async instructions(userId: string, id: string): Promise<{ name: string; instructions: string } | null> {
    const res = await this.db.query(`SELECT name, instructions FROM ai_skills WHERE id = $1 AND owner_id = $2`, [id, userId])
    return res.rows[0] ?? null
  }

  private duplicate(err: unknown): unknown {
    return (err as { code?: string })?.code === '23505' ? new ConflictException('Bạn đã có skill dùng lệnh này') : err
  }
}
