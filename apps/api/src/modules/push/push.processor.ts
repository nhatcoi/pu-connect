import { Logger } from '@nestjs/common'
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq'
import { DelayedError, type Job } from 'bullmq'
import { DatabaseService } from '../../database/database.service'
import { RealtimeGateway } from '../realtime/realtime.gateway'
import { isPushEnabled, quietHoursEnd, resolveSettings } from '../notifications/notification-settings'
import { markdownToPlainText, type NotificationType } from '../notifications/notification.types'
import { PushService } from './push.service'
import { PUSH_QUEUE, PUSH_RATE_LIMIT_PER_HOUR, type PushJobData } from './push.constants'

const URGENT_TYPES = new Set(['comment_reply', 'user_mention', 'accepted_solution', 'ai_reply'])

// Worker BullMQ: quyết định có push hay không tại thời điểm chạy (sau 30s)
@Processor(PUSH_QUEUE, { concurrency: 5 })
export class PushProcessor extends WorkerHost {
  private readonly logger = new Logger(PushProcessor.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly push: PushService,
    private readonly realtime: RealtimeGateway
  ) {
    super()
  }

  async process(job: Job<PushJobData>, token?: string): Promise<string> {
    const { notificationId, recipientId } = job.data
    const res = await this.db.query(
      `SELECT n.id, n.type, n.title, n.message, n.link, n.group_key, n.is_read, n.entity_type, n.entity_id,
              u.notification_settings, u.account_type
       FROM notifications n JOIN users u ON u.id = n.recipient_id
       WHERE n.id = $1 AND n.recipient_id = $2`,
      [notificationId, recipientId]
    )
    const n = res.rows[0]
    if (!n) return 'skip:gone'
    if (n.is_read) return 'skip:read' // đã xem trong app
    if (n.account_type !== 'human') return 'skip:bot'
    if (!isPushEnabled(n.notification_settings, n.type as NotificationType)) return 'skip:muted'
    if (await this.realtime.isUserActive(recipientId)) return 'skip:active' // đang nhìn thấy app

    // Giờ yên tĩnh ⇒ hoãn tới khi kết thúc (không bỏ)
    const resumeAt = quietHoursEnd(resolveSettings(n.notification_settings).quietHours)
    if (resumeAt && token) {
      await job.moveToDelayed(resumeAt + Math.floor(Math.random() * 60_000), token)
      throw new DelayedError()
    }

    // Chống spam: tối đa N push / giờ / người (đếm push đã gửi trong 1 giờ qua)
    const recent = await this.db.query(
      `SELECT COUNT(*)::int AS c FROM notifications
       WHERE recipient_id = $1 AND push_sent_at > NOW() - INTERVAL '1 hour'`,
      [recipientId]
    )
    if ((recent.rows[0]?.c || 0) >= PUSH_RATE_LIMIT_PER_HOUR) return 'skip:rate-limited'

    const unread = await this.db.query(
      `SELECT COUNT(*)::int AS c FROM notifications WHERE recipient_id = $1 AND is_read = FALSE`,
      [recipientId]
    )
    const link = n.link || (n.entity_type === 'post' && n.entity_id ? `/post/${n.entity_id}` : '/notifications')
    const result = await this.push.sendToUser(
      recipientId,
      {
        title: n.title,
        body: n.message ? markdownToPlainText(n.message) : 'PU Connector',
        url: link,
        tag: n.group_key || n.id,
        notificationId: n.id,
        type: n.type,
        unreadCount: unread.rows[0]?.c || 0
      },
      URGENT_TYPES.has(n.type) ? 'high' : 'normal'
    )

    if (result.sent === 0 && result.failed > 0) {
      throw new Error(`push failed for all ${result.failed} subscription(s)`) // BullMQ thử lại (backoff)
    }
    if (result.sent > 0) {
      await this.db.query(`UPDATE notifications SET push_sent_at = NOW() WHERE id = $1`, [n.id])
    }
    if (result.sent > 0) return `sent:${result.sent}`
    return result.removed > 0 ? `expired:${result.removed}` : 'skip:no-subscription'
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PushJobData> | undefined, err: Error) {
    this.logger.warn(`Push job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`)
  }
}
