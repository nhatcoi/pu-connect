import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { ChatSharedPost, SharePostInput, SharePostResult } from '@pu/schemas'
import { DatabaseService } from '../../../database/database.service'
import { markdownToPlainText } from '../../notifications/notification.types'
import { ConversationsService } from '../conversations/conversations.service'
import { MessagesService } from '../messages/messages.service'

const EXCERPT_MAX = 200
const VIDEO_URL = /\.(mp4|webm|mov|m4v)(\?|$)/i

// Chia sẻ bài viết vào chat: ảnh chụp bài → mở DM cho người được chọn → gửi một tin mỗi nơi
// Share a post into chats: snapshot once, open DMs for picked users, one message per target
@Injectable()
export class ChatShareService {
  private readonly logger = new Logger(ChatShareService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly conversations: ConversationsService,
    private readonly messages: MessagesService
  ) {}

  async sharePost(userId: string, input: SharePostInput): Promise<SharePostResult> {
    const post = await this.snapshot(userId, input.postId)
    const targets = await this.resolveTargets(userId, input)

    // Mỗi đích độc lập: một nơi lỗi (bị chặn, đã rời nhóm) không chặn các nơi khác
    // Per-target isolation: one failure never aborts the rest
    const sentTo: string[] = []
    for (const conversationId of targets) {
      try {
        await this.messages.sendShared(userId, conversationId, { content: input.note ?? '' }, post)
        sentTo.push(conversationId)
      } catch (err: any) {
        this.logger.warn(`share post ${post.id} → ${conversationId} failed: ${err?.message}`)
      }
    }
    const failed = Math.max(0, input.conversationIds.length + input.userIds.length - sentTo.length)
    if (sentTo.length) await this.db.query(`UPDATE posts SET shares_count = COALESCE(shares_count, 0) + $2 WHERE id = $1`, [post.id, sentTo.length])
    return { sent: sentTo.length, failed, conversationIds: sentTo }
  }

  // Bài phải xem được bởi người chia sẻ (chưa bị ẩn, công khai hoặc của chính mình)
  private async snapshot(userId: string, postId: string): Promise<ChatSharedPost> {
    const res = await this.db.query(
      `SELECT p.id, p.title, p.content, p.media_urls, u.username, u.display_name, u.avatar_url
       FROM posts p JOIN users u ON u.id = p.author_id
       WHERE p.id = $1 AND p.hidden_at IS NULL AND (p.visibility = 'public' OR p.author_id = $2)`,
      [postId, userId]
    )
    const row = res.rows[0]
    if (!row) throw new NotFoundException('Bài viết không tồn tại hoặc bạn không xem được')
    const plain = markdownToPlainText(row.content || '').replace(/\s+/g, ' ').trim()
    return {
      id: row.id,
      title: (row.title || '').slice(0, 200),
      excerpt: plain.length > EXCERPT_MAX ? `${plain.slice(0, EXCERPT_MAX - 1)}…` : plain,
      image: ((row.media_urls as string[] | null) ?? []).find((url) => !VIDEO_URL.test(url)) ?? null,
      author: { username: row.username, displayName: row.display_name || row.username, avatarUrl: row.avatar_url || null }
    }
  }

  // Hội thoại có sẵn: chỉ DM / nhóm mình đang ở (không gửi vào thread N7AI); người ⇒ mở DM (kiểm chặn, tài khoản)
  // Existing direct/group chats the user is in + DMs opened per picked user (deduplicated)
  private async resolveTargets(userId: string, input: SharePostInput): Promise<string[]> {
    const ids = new Set<string>()
    if (input.conversationIds.length) {
      const res = await this.db.query(
        `SELECT c.id FROM conversations c
         JOIN conversation_members m ON m.conversation_id = c.id AND m.user_id = $1 AND m.left_at IS NULL
         WHERE c.id = ANY($2::uuid[]) AND c.type IN ('direct', 'group')`,
        [userId, input.conversationIds]
      )
      for (const row of res.rows) ids.add(row.id)
    }
    for (const targetId of new Set(input.userIds)) {
      if (targetId === userId) continue
      try {
        const conv = await this.conversations.openDirect(userId, targetId)
        if (conv.type === 'direct') ids.add(conv.id)
      } catch (err: any) {
        this.logger.warn(`share: cannot open DM ${userId} → ${targetId}: ${err?.message}`)
      }
    }
    if (!ids.size) throw new BadRequestException('Không gửi được tới nơi nào đã chọn')
    return [...ids]
  }
}
