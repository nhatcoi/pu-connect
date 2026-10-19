import { Logger } from '@nestjs/common'
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq'
import { DelayedError, type Job } from 'bullmq'
import { DatabaseService } from '../../../database/database.service'
import { isPushEnabled, quietHoursEnd, resolveSettings } from '../../notifications/notification-settings'
import { markdownToPlainText, snippet } from '../../notifications/notification.types'
import { PushService } from '../../push/push.service'
import { RealtimeGateway } from '../../realtime/realtime.gateway'
import { CHAT_PUSH_QUEUE, chatNotificationTag, type ChatPushJobData, type ChatPushJobName } from './chat-push.constants'

// Trạng thái người nhận + tin chưa đọc mới nhất của 1 hội thoại (1 truy vấn)
const STATE_SQL = `
  SELECT c.type, c.title, me.muted_until, u.notification_settings,
         (SELECT COUNT(*) FROM messages m
          WHERE m.conversation_id = c.id AND m.id > me.last_read_message_id AND m.deleted_at IS NULL
            AND m.kind <> 'system' AND m.status <> 'streaming' AND m.sender_id IS DISTINCT FROM me.user_id)::int AS unread,
         EXISTS (SELECT 1 FROM message_mentions mm JOIN messages mmsg ON mmsg.id = mm.message_id
                 WHERE mm.user_id = me.user_id AND mm.conversation_id = c.id AND mm.message_id > me.last_read_message_id
                   AND mmsg.deleted_at IS NULL) AS mentioned,
         (SELECT json_build_object('content', m.content, 'files', COALESCE(jsonb_array_length(m.attachments), 0),
                                   'images', (SELECT COUNT(*) FROM jsonb_array_elements(COALESCE(m.attachments, '[]'::jsonb)) a WHERE a->>'kind' = 'image'),
                                   'sharedPost', m.meta->'sharedPost'->>'title',
                                   'sender', s.display_name)
          FROM messages m LEFT JOIN users s ON s.id = m.sender_id
          WHERE m.conversation_id = c.id AND m.id > me.last_read_message_id AND m.deleted_at IS NULL
            AND m.kind <> 'system' AND m.status <> 'streaming' AND m.sender_id IS DISTINCT FROM me.user_id
          ORDER BY m.id DESC LIMIT 1) AS last
  FROM conversation_members me
  JOIN conversations c ON c.id = me.conversation_id
  JOIN users u ON u.id = me.user_id
  WHERE me.conversation_id = $1 AND me.user_id = $2 AND me.left_at IS NULL AND u.account_type = 'human'`

type LastMessage = { content: string | null; files: number; images: number; sharedPost: string | null; sender: string | null }

// Worker: tại thời điểm chạy mới quyết định — đã đọc / đang mở app / tắt thông báo / giờ yên tĩnh ⇒ bỏ hoặc hoãn
@Processor(CHAT_PUSH_QUEUE, { concurrency: 5 })
export class ChatPushProcessor extends WorkerHost {
  private readonly logger = new Logger(ChatPushProcessor.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly push: PushService,
    private readonly realtime: RealtimeGateway
  ) {
    super()
  }

  async process(job: Job<ChatPushJobData, string, ChatPushJobName>, token?: string): Promise<string> {
    return job.name === 'clear' ? this.clear(job.data) : this.send(job, token)
  }

  // Đóng thông báo của hội thoại trên mọi thiết bị (SW đóng theo tag, không hiện gì)
  private async clear({ conversationId, recipientId }: ChatPushJobData): Promise<string> {
    const result = await this.push.sendSilent(recipientId, { kind: 'close', tag: chatNotificationTag(conversationId) })
    return result.sent > 0 ? `cleared:${result.sent}` : 'skip:no-subscription'
  }

  private async send(job: Job<ChatPushJobData>, token?: string): Promise<string> {
    const { conversationId, recipientId } = job.data
    const res = await this.db.query(STATE_SQL, [conversationId, recipientId])
    const s = res.rows[0]
    if (!s) return 'skip:not-member'
    if (!s.unread || !s.last) return 'skip:read'
    // Tắt tiếng chỉ chặn tin thường; bị nhắc vẫn báo
    if (!s.mentioned && s.muted_until && new Date(s.muted_until).getTime() > Date.now()) return 'skip:muted'
    if (!isPushEnabled(s.notification_settings, 'chat_message')) return 'skip:disabled'
    if (await this.realtime.isUserActive(recipientId)) return 'skip:active'

    const resumeAt = quietHoursEnd(resolveSettings(s.notification_settings).quietHours)
    if (resumeAt && token) {
      await job.moveToDelayed(resumeAt + Math.floor(Math.random() * 60_000), token)
      throw new DelayedError()
    }

    const last = s.last as LastMessage
    const sender = last.sender || 'Thành viên'
    const name = s.type === 'group' ? s.title || 'Nhóm chat' : s.type === 'ai' ? 'N7AI' : sender
    const preview = this.preview(last)
    // Đánh dấu TRƯỚC khi gửi: đọc trong lúc gửi vẫn kích hoạt "đóng" (thừa 1 push im lặng còn hơn sót)
    await this.db.query(`UPDATE conversation_members SET push_shown_at = NOW() WHERE conversation_id = $1 AND user_id = $2`, [conversationId, recipientId])
    const result = await this.push.sendToUser(
      recipientId,
      {
        title: s.mentioned ? `${name} · có người nhắc đến bạn` : s.unread > 1 ? `${name} · ${s.unread} tin mới` : name,
        body: s.type === 'group' ? `${sender}: ${preview}` : preview,
        url: s.type === 'ai' ? `/n7ai/${conversationId}` : `/messages/${conversationId}`, // N7AI có không gian riêng
        tag: chatNotificationTag(conversationId), // tin sau thay thế thông báo trước của cùng hội thoại
        type: 'chat_message'
      },
      s.type === 'group' ? 'normal' : 'high'
    )
    if (result.sent === 0 && result.failed > 0) throw new Error(`push failed for all ${result.failed} subscription(s)`)
    return result.sent > 0 ? `sent:${result.sent}` : 'skip:no-subscription'
  }

  // Nội dung xem trước: chữ, hoặc mô tả tệp đính kèm
  private preview(m: LastMessage): string {
    const text = snippet(markdownToPlainText(m.content || ''), 140)
    if (text) return text
    if (m.sharedPost !== null && m.sharedPost !== undefined) return m.sharedPost ? `🔗 Đã chia sẻ bài viết: ${snippet(m.sharedPost, 100)}` : '🔗 Đã chia sẻ một bài viết'
    if (m.images && m.images === m.files) return m.images > 1 ? `🖼️ ${m.images} ảnh` : '🖼️ Ảnh'
    if (m.files) return `📎 ${m.files} tệp đính kèm`
    return 'Tin nhắn mới'
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ChatPushJobData> | undefined, err: Error) {
    this.logger.warn(`Chat push job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`)
  }
}
