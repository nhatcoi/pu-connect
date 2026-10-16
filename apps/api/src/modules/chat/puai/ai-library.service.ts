import { Injectable } from '@nestjs/common'
import type { AiLibraryItem, AiLibraryPage, ChatAttachment } from '@pu/schemas'
import { ChatCoreService } from '../chat-core.service'
import type { AiLibraryQuery } from '../dto/chat.dto'

// Điều kiện theo loại (alias m = tin); $2 = tham số riêng của loại
const KIND_FILTER: Record<AiLibraryQuery['kind'], string> = {
  image: `m.attachments @> $2::jsonb`,
  file: `m.attachments @> $2::jsonb`,
  study: `m.kind = 'ai' AND m.status = 'done' AND m.content ~ $2`
}
const STUDY_BLOCK_RE = '```(quiz|flashcards)'

// Thư viện PU AI: tệp & học liệu gom từ mọi thread của mình, keyset theo id tin (mới trước)
@Injectable()
export class AiLibraryService {
  constructor(private readonly core: ChatCoreService) {}

  async list(userId: string, query: AiLibraryQuery): Promise<AiLibraryPage> {
    const { kind, limit } = query
    const params: unknown[] = [userId, kind === 'study' ? STUDY_BLOCK_RE : JSON.stringify([{ kind }]), limit + 1]
    const keyset = query.cursor ? `AND m.id < $${params.push(query.cursor)}::bigint` : ''
    // Thread của mình (idx_conversations_ai_threads) ⇒ tin theo idx_messages_conv
    const res = await this.core.db.query(
      `SELECT m.id, m.conversation_id, c.title, m.created_at, m.attachments, m.content
       FROM conversations c JOIN messages m ON m.conversation_id = c.id
       WHERE c.type = 'ai' AND c.created_by = $1 AND m.deleted_at IS NULL AND ${KIND_FILTER[kind]} ${keyset}
       ORDER BY m.id DESC LIMIT $3`,
      params
    )
    const rows = res.rows.slice(0, limit)
    const data: AiLibraryItem[] = rows.map((r) => ({
      messageId: String(r.id),
      threadId: r.conversation_id,
      threadTitle: r.title,
      createdAt: new Date(r.created_at).toISOString(),
      attachments: kind === 'study' ? [] : ((r.attachments as ChatAttachment[] | null) ?? []).filter((a) => a.kind === kind),
      content: kind === 'study' ? r.content : null
    }))
    return { data, nextCursor: res.rows.length > limit ? data[data.length - 1].messageId : null }
  }
}
