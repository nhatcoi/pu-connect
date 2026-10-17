import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { AiPublicSkill, AiSkill, AiSkillDetail, AiSkillInput, ChatSkillRef } from '@pu/schemas'
import { DatabaseService } from '../../../database/database.service'
import type { Queryable } from '../chat-core.service'
import { AI_SKILL_LIMIT } from '../dto/chat.dto'

const LIST_COLUMNS = `id, slug, name, description, input_hint, use_count, is_public, install_count, enabled, pinned`
const LIBRARY_LIMIT = 30

const mapSkill = (r: any): AiSkill => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  description: r.description,
  inputHint: r.input_hint,
  useCount: r.use_count,
  isPublic: r.is_public,
  installCount: r.install_count,
  enabled: r.enabled,
  pinned: r.pinned
})

// Lệnh còn trống: slug, slug-2 … (giữ ≤ 40 ký tự)
export function freeSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base
  for (let i = 2; ; i++) {
    const candidate = `${base.slice(0, 40 - String(i).length - 1)}-${i}`
    if (!taken.has(candidate)) return candidate
  }
}

// Skill tự tạo (slash command "/slug"): chỉ dẫn bổ sung cho PU AI, riêng từng người
// Chia sẻ công khai ⇒ người khác "cài" (sao chép) từ thư viện; bản cài độc lập với bản gốc
@Injectable()
export class AiSkillsService {
  constructor(private readonly db: DatabaseService) {}

  // Danh sách nhẹ cho menu "/" (không có instructions): ghim → hay dùng
  async list(userId: string): Promise<AiSkill[]> {
    const res = await this.db.query(
      `SELECT ${LIST_COLUMNS} FROM ai_skills WHERE owner_id = $1 ORDER BY pinned DESC, last_used_at DESC NULLS LAST, created_at DESC`,
      [userId]
    )
    return res.rows.map(mapSkill)
  }

  // Lệnh đã dùng (đặt lệnh không trùng cho bản nháp / bản cài)
  async slugs(userId: string): Promise<Set<string>> {
    const res = await this.db.query(`SELECT slug FROM ai_skills WHERE owner_id = $1`, [userId])
    return new Set(res.rows.map((r) => r.slug as string))
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
        `INSERT INTO ai_skills (owner_id, slug, name, description, instructions, input_hint, is_public)
         SELECT $1, $2, $3, $4, $5, $6, $8 WHERE (SELECT COUNT(*) FROM ai_skills WHERE owner_id = $1) < $7
         RETURNING ${LIST_COLUMNS}, instructions`,
        [userId, input.slug, input.name, input.description, input.instructions, input.inputHint ?? null, AI_SKILL_LIMIT, input.isPublic]
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
        `UPDATE ai_skills SET slug = $3, name = $4, description = $5, instructions = $6, input_hint = $7, is_public = $8, updated_at = NOW()
         WHERE id = $1 AND owner_id = $2 RETURNING ${LIST_COLUMNS}, instructions`,
        [id, userId, input.slug, input.name, input.description, input.instructions, input.inputHint ?? null, input.isPublic]
      )
      if (!res.rows[0]) throw new NotFoundException('Không tìm thấy skill')
      return { ...mapSkill(res.rows[0]), instructions: res.rows[0].instructions }
    } catch (err) {
      throw this.duplicate(err)
    }
  }

  // Thư viện: skill công khai của người khác (skill dựng sẵn của PU AI → nhiều lượt cài), đánh dấu đã cài
  async library(userId: string, q: string): Promise<AiPublicSkill[]> {
    const term = q
      .trim()
      .toLowerCase()
      .replace(/[%_\\]/g, (c) => `\\${c}`)
    const res = await this.db.query(
      `SELECT s.id, s.slug, s.name, s.description, s.install_count, u.username, u.display_name, u.account_type = 'bot' AS official,
              EXISTS (SELECT 1 FROM ai_skills m WHERE m.owner_id = $1 AND m.source_skill_id = s.id) AS installed
       FROM ai_skills s JOIN users u ON u.id = s.owner_id
       WHERE s.is_public AND s.owner_id <> $1 AND u.status = 'active'
         ${term ? `AND immutable_unaccent(lower(s.name || ' ' || s.description || ' ' || s.slug)) LIKE '%' || immutable_unaccent($3) || '%'` : ''}
       ORDER BY official DESC, s.install_count DESC, s.created_at DESC LIMIT $2`,
      term ? [userId, LIBRARY_LIMIT, term] : [userId, LIBRARY_LIMIT]
    )
    return res.rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      installCount: r.install_count,
      author: { username: r.username, displayName: r.display_name },
      official: r.official,
      installed: r.installed
    }))
  }

  // Cài skill công khai = sao chép về skill của mình (lệnh trùng ⇒ thêm hậu tố), tăng lượt cài của bản gốc
  async install(userId: string, sourceId: string): Promise<AiSkillDetail> {
    return this.db.transaction(async (client) => {
      const src = await client.query(`SELECT slug, name, description, instructions, input_hint FROM ai_skills WHERE id = $1 AND is_public AND owner_id <> $2`, [
        sourceId,
        userId
      ])
      if (!src.rows[0]) throw new NotFoundException('Không tìm thấy skill công khai')
      const mine = await client.query(`SELECT slug FROM ai_skills WHERE owner_id = $1`, [userId])
      if (mine.rows.length >= AI_SKILL_LIMIT) throw new BadRequestException(`Tối đa ${AI_SKILL_LIMIT} skill`)
      const s = src.rows[0]
      const res = await client.query(
        `INSERT INTO ai_skills (owner_id, slug, name, description, instructions, input_hint, source_skill_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (owner_id, source_skill_id) WHERE source_skill_id IS NOT NULL DO NOTHING
         RETURNING ${LIST_COLUMNS}, instructions`,
        [userId, freeSlug(s.slug, new Set(mine.rows.map((r) => r.slug))), s.name, s.description, s.instructions, s.input_hint, sourceId]
      )
      if (!res.rows[0]) throw new ConflictException('Bạn đã cài skill này')
      await client.query(`UPDATE ai_skills SET install_count = install_count + 1 WHERE id = $1`, [sourceId])
      return { ...mapSkill(res.rows[0]), instructions: res.rows[0].instructions }
    })
  }

  // Bật/tắt (ẩn khỏi menu "/") hoặc ghim lên đầu
  async setState(userId: string, id: string, state: { enabled?: boolean; pinned?: boolean }): Promise<AiSkill> {
    const res = await this.db.query(
      `UPDATE ai_skills SET enabled = COALESCE($3, enabled), pinned = COALESCE($4, pinned), updated_at = NOW()
       WHERE id = $1 AND owner_id = $2 RETURNING ${LIST_COLUMNS}`,
      [id, userId, state.enabled ?? null, state.pinned ?? null]
    )
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy skill')
    return mapSkill(res.rows[0])
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
      `UPDATE ai_skills SET use_count = use_count + 1, last_used_at = NOW() WHERE id = $1 AND owner_id = $2 AND enabled RETURNING id, slug, name`,
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
