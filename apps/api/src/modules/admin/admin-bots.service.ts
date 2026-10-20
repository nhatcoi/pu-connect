import { BadRequestException, Injectable } from '@nestjs/common'
import type { AdminBotActivity, AdminBotAccount, AdminBotCommand, AdminBotCommandInput, AdminBotControlInput, AdminBotOverview, AdminPage, BotSessionStats } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { writeAudit } from './admin-audit'
import { iso, pagedQuery, SqlParams, whereOf } from './admin-paging'
import type { BotActivityQuery } from './dto/admin-bots.dto'

const ONLINE_WINDOW_SECONDS = 30
const MAX_PENDING_COMMANDS = 10

// Điều khiển Bot Simulator: admin ghi trạng thái/lệnh vào DB, daemon (tools/bot-simulator) đọc và thực thi
@Injectable()
export class AdminBotsService {
  constructor(private readonly db: DatabaseService) {}

  async overview(): Promise<AdminBotOverview> {
    const [control, bots, commands, feed] = await Promise.all([
      this.db.query(
        `SELECT enabled, feed_enabled, speed, heartbeat_at, started_at, stats,
                heartbeat_at IS NOT NULL AND heartbeat_at > NOW() - make_interval(secs => $1) AS online
         FROM bot_control WHERE id = 1`,
        [ONLINE_WINDOW_SECONDS]
      ),
      this.db.query(
        `SELECT u.id, u.username, u.display_name, u.faculty, COUNT(a.id)::int AS actions_24h, MAX(a.created_at) AS last_action_at
         FROM users u
         LEFT JOIN bot_activity a ON a.bot_username = u.username AND a.created_at > NOW() - INTERVAL '24 hours'
         WHERE u.is_bot
         GROUP BY u.id ORDER BY u.username`
      ),
      this.db.query(
        `SELECT c.id, c.type, c.payload, c.status, c.result, c.created_at, c.finished_at, u.username AS created_by
         FROM bot_commands c LEFT JOIN users u ON u.id = c.created_by
         ORDER BY c.id DESC LIMIT 15`
      ),
      this.db.query(
        `SELECT COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
                COUNT(*) FILTER (WHERE status = 'posted' AND posted_at > NOW() - INTERVAL '24 hours')::int AS posted_24h,
                MAX(posted_at) AS last_posted_at
         FROM bot_feed_items`
      )
    ])
    const c = control.rows[0]
    return {
      enabled: c.enabled,
      feedEnabled: c.feed_enabled,
      feed: { pending: feed.rows[0].pending, posted24h: feed.rows[0].posted_24h, lastPostedAt: iso(feed.rows[0].last_posted_at) },
      speed: c.speed,
      online: c.online,
      heartbeatAt: iso(c.heartbeat_at),
      startedAt: iso(c.started_at),
      stats: Object.keys(c.stats ?? {}).length ? (c.stats as BotSessionStats) : null,
      bots: bots.rows.map(
        (r): AdminBotAccount => ({
          id: r.id,
          username: r.username,
          displayName: r.display_name,
          faculty: r.faculty,
          actions24h: r.actions_24h,
          lastActionAt: iso(r.last_action_at)
        })
      ),
      commands: commands.rows.map(
        (r): AdminBotCommand => ({
          id: String(r.id),
          type: r.type,
          payload: r.payload,
          status: r.status,
          result: r.result,
          createdBy: r.created_by,
          createdAt: iso(r.created_at)!,
          finishedAt: iso(r.finished_at)
        })
      )
    }
  }

  async activity(q: BotActivityQuery): Promise<AdminPage<AdminBotActivity>> {
    const p = new SqlParams()
    const where = whereOf([q.bot && `bot_username = ${p.add(q.bot)}`, q.level && `level = ${p.add(q.level)}`])
    return pagedQuery(this.db, {
      select: 'id, bot_username, action, details, level, created_at',
      from: `bot_activity ${where}`,
      params: p,
      order: 'created_at DESC, id DESC',
      page: q.page,
      pageSize: q.pageSize,
      map: (r) => ({ id: String(r.id), botUsername: r.bot_username, action: r.action, details: r.details, level: r.level, createdAt: iso(r.created_at)! })
    })
  }

  // ACID Transaction: update control row & write audit log
  async setControl(adminId: string, input: AdminBotControlInput) {
    await this.db.transaction(async (client) => {
      await client.query(
        `UPDATE bot_control SET enabled = COALESCE($1, enabled), speed = COALESCE($2, speed), feed_enabled = COALESCE($3, feed_enabled), updated_by = $4, updated_at = NOW() WHERE id = 1`,
        [input.enabled ?? null, input.speed ?? null, input.feedEnabled ?? null, adminId]
      )
      await writeAudit(client, adminId, { action: 'bot.control', targetType: 'bot', targetId: 'simulator', details: { ...input } })
    })
    return this.overview()
  }

  // ACID Transaction: validate target bots, cap queue, enqueue command & audit
  async enqueue(adminId: string, input: AdminBotCommandInput) {
    const { type, ...payload } = input
    const usernames = ['bot', 'botA', 'botB'].map((k) => (payload as Record<string, unknown>)[k]).filter((v): v is string => typeof v === 'string')
    await this.db.transaction(async (client) => {
      if (usernames.length) {
        const found = await client.query(`SELECT username FROM users WHERE is_bot AND username = ANY($1::text[])`, [usernames])
        const missing = usernames.filter((u) => !found.rows.some((r) => r.username === u))
        if (missing.length) throw new BadRequestException(`Không phải bot: ${missing.join(', ')}`)
      }
      // Khóa dòng điều khiển để đếm hàng đợi không bị race giữa 2 admin
      await client.query(`SELECT 1 FROM bot_control WHERE id = 1 FOR UPDATE`)
      const pending = await client.query(`SELECT COUNT(*)::int AS n FROM bot_commands WHERE status IN ('pending', 'running')`)
      if (pending.rows[0].n >= MAX_PENDING_COMMANDS) throw new BadRequestException('Hàng đợi lệnh đầy, chờ bot xử lý xong')
      const res = await client.query(`INSERT INTO bot_commands (type, payload, created_by) VALUES ($1, $2, $3) RETURNING id`, [type, JSON.stringify(payload), adminId])
      await writeAudit(client, adminId, { action: 'bot.command', targetType: 'bot', targetId: String(res.rows[0].id), details: { type, ...payload } })
    })
    return this.overview()
  }
}
