import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { DatabaseService } from '../../../database/database.service'
import { PushService } from '../../push/push.service'
import { CHAT_PUSH_DELAY_MS, CHAT_PUSH_QUEUE, chatClearJobId, chatPushJobId, type ChatPushJobData, type ChatPushJobName } from './chat-push.constants'

// Xếp hàng Web Push cho tin nhắn mới; worker (ChatPushProcessor) quyết định gửi hay bỏ lúc chạy
@Injectable()
export class ChatPushService {
  private readonly logger = new Logger(ChatPushService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly push: PushService,
    @InjectQueue(CHAT_PUSH_QUEUE) private readonly queue: Queue<ChatPushJobData, unknown, ChatPushJobName>
  ) {}

  // Có tin mới (người hoặc PU AI) ⇒ 1 job trễ cho mỗi thành viên người thật khác, chưa tắt thông báo
  // Người bị nhắc (@tên / @all) nhận cả khi đang tắt tiếng hội thoại
  // Gọi sau commit, không await ở luồng gửi tin (lỗi Redis không ảnh hưởng nhắn tin)
  async onNewMessage(conversationId: string, senderId: string | null, mentionedIds: string[] = []): Promise<void> {
    if (!this.push.isEnabled()) return
    try {
      const res = await this.db.query(
        `SELECT me.user_id FROM conversation_members me JOIN users u ON u.id = me.user_id
         WHERE me.conversation_id = $1 AND me.left_at IS NULL AND u.account_type = 'human'
           AND me.user_id IS DISTINCT FROM $2::uuid
           AND (me.muted_until IS NULL OR me.muted_until < NOW() OR me.user_id = ANY($3::uuid[]))`,
        [conversationId, senderId, mentionedIds]
      )
      if (!res.rows.length) return
      const jobs = res.rows.map((r) => ({
        name: 'send' as const,
        data: { conversationId, recipientId: r.user_id as string },
        opts: {
          jobId: chatPushJobId(conversationId, r.user_id),
          delay: CHAT_PUSH_DELAY_MS,
          attempts: 3,
          backoff: { type: 'exponential' as const, delay: 30_000 },
          // Xóa cả job lỗi ⇒ id được dùng lại cho tin sau
          removeOnComplete: true,
          removeOnFail: true
        }
      }))
      await withTimeout(this.queue.addBulk(jobs))
    } catch (err) {
      this.logger.warn(`Chat push enqueue failed (${conversationId}): ${(err as Error).message}`)
    }
  }

  // Đã đọc hội thoại từng hiện thông báo ⇒ đóng thông báo đó trên mọi thiết bị (best-effort)
  async onRead(conversationId: string, userId: string): Promise<void> {
    if (!this.push.isEnabled()) return
    try {
      await withTimeout(
        this.queue.add(
          'clear',
          { conversationId, recipientId: userId },
          { jobId: chatClearJobId(conversationId, userId), attempts: 2, removeOnComplete: true, removeOnFail: true }
        )
      )
    } catch (err) {
      this.logger.warn(`Chat push clear enqueue failed (${conversationId}): ${(err as Error).message}`)
    }
  }
}

// Redis lỗi không được làm treo luồng nhắn tin
function withTimeout<T>(p: Promise<T>, ms = 3000): Promise<T> {
  return Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('enqueue timeout')), ms))])
}
