import { Injectable, Logger } from '@nestjs/common'
import { DatabaseService } from '../../../database/database.service'
import { GOOGLE_PROVIDERS, GoogleOAuthService, type GoogleProvider } from '../../ai/connectors/google-oauth.service'
import { PuConnectorService } from '../../ai/connectors/pu-connector.service'
import { StorageService } from '../../storage/storage.service'
import { ChatCoreService } from '../chat-core.service'

const EXPORT_MESSAGES_PER_THREAD = 500

// Xóa thread AI (cùng snapshot lấy key tệp đính kèm) — dùng cho "xóa toàn bộ" và dọn lịch sử hết hạn
const DELETE_THREADS_SQL = (where: string) => `
  WITH doomed AS (SELECT id, created_by FROM conversations c WHERE c.type = 'ai' AND ${where}),
  files AS (
    SELECT d.created_by, a->>'key' AS key FROM doomed d
    JOIN messages m ON m.conversation_id = d.id AND m.attachments IS NOT NULL
    CROSS JOIN LATERAL jsonb_array_elements(m.attachments) a
  ),
  del AS (DELETE FROM conversations c USING doomed d WHERE c.id = d.id RETURNING c.id, d.created_by)
  SELECT (SELECT json_agg(json_build_object('id', id, 'userId', created_by)) FROM del) AS deleted,
         (SELECT json_agg(json_build_object('userId', created_by, 'key', key)) FROM files) AS files`

// Quyền kiểm soát dữ liệu N7AI: xuất JSON, xóa toàn bộ, tự xóa lịch sử quá hạn (ai_settings.retention_days)
@Injectable()
export class AiDataService {
  private readonly logger = new Logger(AiDataService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly core: ChatCoreService,
    private readonly storage: StorageService,
    private readonly oauth: GoogleOAuthService,
    private readonly puConnector: PuConnectorService
  ) {}

  // Xuất dữ liệu N7AI của mình (≤ 500 tin / thread, không gồm token kết nối)
  async export(userId: string) {
    const q = (sql: string) => this.db.query(sql, [userId]).then((r) => r.rows)
    const [settings, memories, skills, tasks, connectors, threads] = await Promise.all([
      q(`SELECT memory_enabled, retention_days, default_connectors FROM ai_settings WHERE user_id = $1`),
      q(`SELECT content, source, created_at FROM ai_memories WHERE user_id = $1 ORDER BY created_at`),
      q(`SELECT slug, name, description, instructions, input_hint, is_public, enabled, pinned, use_count, created_at FROM ai_skills WHERE owner_id = $1`),
      q(`SELECT title, prompt, frequency, to_char(run_time, 'HH24:MI') AS run_time, weekday, enabled, created_at FROM ai_tasks WHERE user_id = $1`),
      q(`SELECT provider, account_email, created_at FROM user_connectors WHERE user_id = $1`),
      q(`SELECT c.id, c.title, c.created_at,
                COALESCE((SELECT json_agg(json_build_object('role', CASE WHEN m.kind = 'ai' THEN 'assistant' ELSE 'user' END,
                                                            'content', m.content, 'createdAt', m.created_at) ORDER BY m.id)
                          FROM (SELECT * FROM messages WHERE conversation_id = c.id AND kind <> 'system' AND deleted_at IS NULL
                                ORDER BY id DESC LIMIT ${EXPORT_MESSAGES_PER_THREAD}) m), '[]'::json) AS messages
         FROM conversations c WHERE c.type = 'ai' AND c.created_by = $1 ORDER BY c.created_at`)
    ])
    return { exportedAt: new Date().toISOString(), settings: settings[0] ?? null, memories, skills, tasks, connectors, threads }
  }

  // Xóa toàn bộ dữ liệu N7AI (ACID) rồi thu hồi kết nối Google + dọn tệp R2 (best-effort, sau commit)
  async deleteAll(userId: string): Promise<{ threads: number }> {
    const { result, providers } = await this.db.transaction(async (client) => {
      const res = await client.query(DELETE_THREADS_SQL(`c.created_by = $1`), [userId])
      await client.query(`DELETE FROM ai_memories WHERE user_id = $1`, [userId])
      await client.query(`DELETE FROM ai_tasks WHERE user_id = $1`, [userId])
      await client.query(`DELETE FROM ai_skills WHERE owner_id = $1`, [userId])
      await client.query(`DELETE FROM ai_feedback WHERE user_id = $1`, [userId])
      await client.query(`DELETE FROM ai_settings WHERE user_id = $1`, [userId])
      const linked = await client.query(`SELECT provider FROM user_connectors WHERE user_id = $1`, [userId])
      return { result: res.rows[0], providers: linked.rows.map((r) => r.provider as string) }
    })
    for (const p of providers) {
      if (p === 'pu_connector') await this.puConnector.disconnect(userId).catch(() => undefined)
      if (p in GOOGLE_PROVIDERS) await this.oauth.disconnect(userId, p as GoogleProvider).catch(() => undefined)
    }
    const threads = this.afterDelete(result)
    return { threads }
  }

  // Job hằng ngày: xóa thread N7AI không hoạt động quá retention_days của chủ thread
  async purgeExpired(): Promise<number> {
    const res = await this.db.query(
      DELETE_THREADS_SQL(`EXISTS (SELECT 1 FROM ai_settings s WHERE s.user_id = c.created_by AND s.retention_days IS NOT NULL
                                   AND COALESCE(c.last_message_at, c.created_at) < NOW() - make_interval(days => s.retention_days))`)
    )
    const n = this.afterDelete(res.rows[0])
    if (n) this.logger.log(`Đã xóa ${n} hội thoại N7AI quá hạn lưu`)
    return n
  }

  // Báo các tab đang mở + xóa tệp do chính chủ thread tải lên
  private afterDelete(row: { deleted: { id: string; userId: string }[] | null; files: { userId: string; key: string }[] | null }): number {
    const deleted = row?.deleted ?? []
    for (const d of deleted) this.core.emitTo([d.userId], 'conv.removed', { conversationId: d.id })
    const keys = (row?.files ?? []).filter((f) => this.storage.isOwnedKey(f.key, 'chat', f.userId)).map((f) => f.key)
    if (keys.length) void this.storage.deleteObjects(keys)
    return deleted.length
  }
}
