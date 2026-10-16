import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import * as webpush from 'web-push'
import { DatabaseService } from '../../database/database.service'
import { APPLE_PUSH_ORIGIN, PUSH_DELAY_MS, PUSH_QUEUE, PUSH_TTL_SECONDS, type PushJobData, type PushPayload, type SilentPushPayload } from './push.constants'

export interface SubscriptionInput {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

type SendResult = { sent: number; removed: number; failed: number }
type SubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string }

// Web Push (VAPID): lưu đăng ký trình duyệt, xếp job vào BullMQ, gửi qua push service
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name)
  private enabled = false
  private publicKey: string | null = null

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @InjectQueue(PUSH_QUEUE) private readonly queue: Queue<PushJobData>
  ) {}

  onModuleInit() {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY')
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY')
    const subject = this.config.get<string>('VAPID_SUBJECT') || 'mailto:admin@puc.vnhat.dev'
    if (!publicKey || !privateKey) {
      this.logger.warn('VAPID keys missing — Web Push disabled (in-app notifications still work)')
      return
    }
    webpush.setVapidDetails(subject, publicKey, privateKey)
    this.publicKey = publicKey
    this.enabled = true
  }

  getConfig() {
    return { enabled: this.enabled, publicKey: this.publicKey }
  }

  isEnabled() {
    return this.enabled
  }

  // ── Đăng ký ──────────────────────────────────────────────────────

  async subscribe(userId: string, input: SubscriptionInput, userAgent?: string): Promise<void> {
    // endpoint là duy nhất cho mỗi trình duyệt; đăng nhập tài khoản khác trên cùng máy ⇒ chuyển chủ
    await this.db.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent, failure_count = 0`,
      [userId, input.endpoint, input.keys.p256dh, input.keys.auth, userAgent?.slice(0, 300) || null]
    )
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.db.query(`DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`, [userId, endpoint])
  }

  async countSubscriptions(userId: string): Promise<number> {
    const res = await this.db.query(`SELECT COUNT(*)::int AS n FROM push_subscriptions WHERE user_id = $1`, [userId])
    return res.rows[0]?.n || 0
  }

  // ── Xếp hàng ─────────────────────────────────────────────────────

  // jobId theo thông báo: thông báo gộp cập nhật liên tục trong 30s chỉ tạo MỘT push (nội dung mới nhất)
  async enqueue(notificationId: string, recipientId: string): Promise<void> {
    if (!this.enabled) return
    const add = this.queue.add(
      'send',
      { notificationId, recipientId },
      {
        jobId: `push-${notificationId}`,
        delay: PUSH_DELAY_MS,
        attempts: 5,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: true,
        removeOnFail: { age: 7 * 24 * 3600 }
      }
    )
    // Redis lỗi không được làm treo luồng thông báo in-app
    await Promise.race([add, new Promise((_, reject) => setTimeout(() => reject(new Error('enqueue timeout')), 3000))]).catch((err) =>
      this.logger.warn(`Push enqueue failed (${notificationId}): ${err?.message}`)
    )
  }

  // ── Gửi ──────────────────────────────────────────────────────────

  async sendToUser(userId: string, payload: PushPayload, urgency: webpush.Urgency = 'normal'): Promise<SendResult> {
    const subs = await this.db.query(`SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`, [userId])
    return this.deliver(subs.rows, JSON.stringify(payload), urgency, payload.tag)
  }

  // Push "im lặng" (SW xử lý, không hiện thông báo), vd. đóng thông báo đã đọc ở thiết bị khác
  // Bỏ qua Apple: Safari thu hồi đăng ký nếu push không hiện thông báo. Cùng `topic` ⇒ thay push cũ chưa giao
  async sendSilent(userId: string, payload: SilentPushPayload): Promise<SendResult> {
    const subs = await this.db.query(`SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1 AND endpoint NOT LIKE $2`, [
      userId,
      `${APPLE_PUSH_ORIGIN}%`
    ])
    return this.deliver(subs.rows, JSON.stringify(payload), 'normal', payload.tag)
  }

  private async deliver(subs: SubscriptionRow[], body: string, urgency: webpush.Urgency, tag: string): Promise<SendResult> {
    const result: SendResult = { sent: 0, removed: 0, failed: 0 }
    const topic = tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || undefined

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body, {
            TTL: PUSH_TTL_SECONDS,
            urgency,
            topic
          })
          result.sent++
          await this.db.query(`UPDATE push_subscriptions SET last_used_at = NOW(), failure_count = 0 WHERE id = $1`, [sub.id])
        } catch (err: any) {
          // 404/410: đăng ký đã hết hạn hoặc người dùng thu hồi quyền ⇒ xóa
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            result.removed++
            await this.db.query(`DELETE FROM push_subscriptions WHERE id = $1`, [sub.id])
          } else {
            result.failed++
            await this.db.query(`UPDATE push_subscriptions SET failure_count = failure_count + 1 WHERE id = $1`, [sub.id])
            this.logger.warn(`Push failed (${err?.statusCode || 'network'}): ${err?.body || err?.message}`)
          }
        }
      })
    )
    return result
  }
}
