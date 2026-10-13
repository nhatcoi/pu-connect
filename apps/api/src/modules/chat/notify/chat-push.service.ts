import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { DatabaseService } from '../../../database/database.service'
import { PushService } from '../../push/push.service'
import { CHAT_PUSH_DELAY_MS, CHAT_PUSH_QUEUE, chatPushJobId, type ChatPushJobData } from './chat-push.constants'

// Xếp hàng Web Push cho tin nhắn mới; worker (ChatPushProcessor) quyết định gửi hay bỏ lúc chạy
@Injectable()
export class ChatPushService {
  private readonly logger = new Logger(ChatPushService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly push: PushService,
    @InjectQueue(CHAT_PUSH_QUEUE) private readonly queue: Queue<ChatPushJobData>
  ) {}

  // Có tin mới (người hoặc PU AI) ⇒ 1 job trễ cho mỗi thành viên người thật khác, chưa tắt thông báo
  // Gọi sau commit, không await ở luồng gửi tin (lỗi Redis không ảnh hưởng nhắn tin)
  async onNewMessage(conversationId: string, senderId: string | null): Promise<void> {
    if (!this.push.isEnabled()) return
    try {
      const res = await this.db.query(
        `SELECT me.user_id FROM conversation_members me JOIN users u ON u.id = me.user_id
         WHERE me.conversation_id = $1 AND me.left_at IS NULL AND u.account_type = 'human'
           AND me.user_id IS DISTINCT FROM $2::uuid
           AND (me.muted_until IS NULL OR me.muted_until < NOW())`,
        [conversationId, senderId]
      )
      if (!res.rows.length) return
      const jobs = res.rows.map((r) => ({
        name: 'send',
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
      await Promise.race([
        this.queue.addBulk(jobs),
        new Promise((_, reject) => setTimeout(() => reject(new Error('enqueue timeout')), 3000))
      ])
    } catch (err) {
      this.logger.warn(`Chat push enqueue failed (${conversationId}): ${(err as Error).message}`)
    }
  }
}
