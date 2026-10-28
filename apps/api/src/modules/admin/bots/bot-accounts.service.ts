import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import type { AdminBotAccount, AdminBotAccountInput, AdminBotAccountUpdate } from '@pu/schemas'
import { DatabaseService } from '../../../database/database.service'
import { UnitRequestsService } from '../../units/unit-requests.service'
import { writeAudit } from '../admin-audit'

const BCRYPT_ROUNDS = 10

// Tài khoản bot (users.is_bot) + persona trong bot_profiles
@Injectable()
export class BotAccountsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly units: UnitRequestsService
  ) {}

  async list(): Promise<AdminBotAccount[]> {
    const res = await this.db.query(
      `SELECT u.id, u.username, u.display_name, u.role, u.interest_field_id, (SELECT x.name FROM interest_fields x WHERE x.id = u.interest_field_id) AS interest_field, u.bio, p.tone, p.soul,
              (SELECT COUNT(*) FROM bot_jobs j WHERE j.bot_id = u.id)::int AS jobs_count,
              (SELECT COUNT(*) FROM posts x WHERE x.author_id = u.id)::int AS posts_count
       FROM users u LEFT JOIN bot_profiles p ON p.user_id = u.id
       WHERE u.is_bot ORDER BY u.username`
    )
    return res.rows.map((r) => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      role: r.role,
      interestFieldId: r.interest_field_id,
      interestField: r.interest_field,
      bio: r.bio ?? '',
      tone: r.tone ?? '',
      soul: r.soul ?? '',
      jobsCount: r.jobs_count,
      postsCount: r.posts_count
    }))
  }

  // Mật khẩu chung của bot (BOT_PASSWORD); dev local dùng mặc định
  private password() {
    const pw = process.env.BOT_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'BotPassword@123')
    if (!pw) throw new BadRequestException('Thiếu BOT_PASSWORD trên server, chưa thể tạo bot')
    return pw
  }

  // ACID Transaction: tạo user (is_bot) + persona + audit
  async create(adminId: string, input: AdminBotAccountInput) {
    const hash = await bcrypt.hash(this.password(), BCRYPT_ROUNDS)
    await this.db.transaction(async (client) => {
      const taken = await client.query(`SELECT 1 FROM users WHERE username = $1 OR email = $2`, [input.username, `${input.username}@seed.pu-connector.test`])
      if (taken.rowCount) throw new ConflictException('Username đã tồn tại')
      const user = await client.query(
        `INSERT INTO users (id, email, username, password_hash, display_name, role, status, is_onboarded, email_verified, email_verified_at, interest_field_id, bio, is_bot, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'active', true, true, NOW(), $6, $7, true, NOW()) RETURNING id`,
        [`${input.username}@seed.pu-connector.test`, input.username, hash, input.displayName, input.role, input.interestFieldId ?? null, input.bio ?? '']
      )
      // Lĩnh vực chính của bot cũng nằm trong danh sách lĩnh vực quan tâm (user_interest_fields)
      if (input.interestFieldId) await this.units.setFieldIds(client, user.rows[0].id, [input.interestFieldId])
      await client.query(`INSERT INTO bot_profiles (user_id, tone, soul, updated_by) VALUES ($1, $2, $3, $4)`, [
        user.rows[0].id,
        input.tone ?? '',
        input.soul ?? '',
        adminId
      ])
      await writeAudit(client, adminId, { action: 'bot.account_create', targetType: 'bot', targetId: input.username, details: { ...input } })
    })
  }

  async update(adminId: string, username: string, input: AdminBotAccountUpdate) {
    await this.db.transaction(async (client) => {
      const bot = await client.query(
        `UPDATE users SET display_name = COALESCE($2, display_name), role = COALESCE($3::user_role_enum, role), interest_field_id = COALESCE($4::uuid, interest_field_id), bio = COALESCE($5, bio)
         WHERE username = $1 AND is_bot RETURNING id`,
        [username, input.displayName ?? null, input.role ?? null, input.interestFieldId ?? null, input.bio ?? null]
      )
      if (!bot.rowCount) throw new NotFoundException('Không phải bot')
      if (input.interestFieldId) await this.units.setFieldIds(client, bot.rows[0].id, [input.interestFieldId])
      await client.query(
        `INSERT INTO bot_profiles (user_id, tone, soul, updated_by) VALUES ($1, COALESCE($2, ''), COALESCE($3, ''), $4)
         ON CONFLICT (user_id) DO UPDATE SET
           tone = COALESCE($2, bot_profiles.tone), soul = COALESCE($3, bot_profiles.soul), updated_by = $4, updated_at = NOW()`,
        [bot.rows[0].id, input.tone ?? null, input.soul ?? null, adminId]
      )
      await writeAudit(client, adminId, { action: 'bot.account_update', targetType: 'bot', targetId: username, details: { ...input } })
    })
  }

  // ACID Transaction: xóa hẳn bot (job, bài, bình luận, tim của bot xóa theo, CASCADE); tính lại bộ đếm các bài bị ảnh hưởng
  async remove(adminId: string, username: string) {
    await this.db.transaction(async (client) => {
      const bot = await client.query(`SELECT id FROM users WHERE username = $1 AND is_bot FOR UPDATE`, [username])
      if (!bot.rowCount) throw new NotFoundException('Không phải bot')
      const id = bot.rows[0].id
      const touched = await client.query(`SELECT post_id FROM comments WHERE author_id = $1 UNION SELECT post_id FROM post_reactions WHERE user_id = $1`, [id])
      await client.query(`DELETE FROM users WHERE id = $1`, [id])
      await client.query(
        `UPDATE posts p SET
           likes_count = (SELECT COUNT(*) FROM post_reactions r WHERE r.post_id = p.id),
           comments_count = (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.hidden_at IS NULL)
         WHERE p.id = ANY($1::uuid[])`,
        [touched.rows.map((r) => r.post_id)]
      )
      await writeAudit(client, adminId, { action: 'bot.account_delete', targetType: 'bot', targetId: username })
    })
  }
}
