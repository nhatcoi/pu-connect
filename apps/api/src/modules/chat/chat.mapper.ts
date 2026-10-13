import type { ChatMember, ChatMessage, ChatUser, ConversationSummary } from '@pu/schemas'

// Cột tin nhắn + người gửi + trích dẫn + cảm xúc (alias m = messages, s = users)
export const MESSAGE_COLUMNS = `
  m.id, m.conversation_id, m.client_msg_id, m.kind, m.content, m.blocks, m.attachments, m.meta,
  m.reply_to_id, m.status, m.deleted_at, m.edited_at, m.pinned_at, m.created_at,
  s.id AS s_id, s.username AS s_username, s.display_name AS s_display_name, s.avatar_url AS s_avatar_url,
  s.account_type AS s_account_type,
  (SELECT json_build_object('id', r.id, 'content', left(r.content, 160), 'deleted', r.deleted_at IS NOT NULL,
                            'hasAttachments', r.attachments IS NOT NULL, 'senderName', ru.display_name)
   FROM messages r LEFT JOIN users ru ON ru.id = r.sender_id WHERE r.id = m.reply_to_id) AS reply_to,
  COALESCE((SELECT json_agg(json_build_object('emoji', x.emoji, 'userIds', x.user_ids) ORDER BY x.first_at)
            FROM (SELECT emoji, json_agg(user_id ORDER BY created_at) AS user_ids, MIN(created_at) AS first_at
                  FROM message_reactions WHERE message_id = m.id GROUP BY emoji) x), '[]'::json) AS reactions`

export const MESSAGE_FROM = `FROM messages m LEFT JOIN users s ON s.id = m.sender_id`

export function mapMessageRow(row: any): ChatMessage {
  const deleted = !!row.deleted_at
  const reply = row.reply_to
  return {
    id: String(row.id),
    conversationId: row.conversation_id,
    sender: row.s_id
      ? {
          id: row.s_id,
          username: row.s_username,
          displayName: row.s_display_name,
          avatarUrl: row.s_avatar_url,
          isBot: row.s_account_type === 'bot'
        }
      : null,
    clientMsgId: row.client_msg_id,
    kind: row.kind,
    // Tin đã thu hồi: không trả nội dung / tệp
    content: deleted ? '' : row.content || '',
    blocks: deleted ? null : row.blocks,
    attachments: deleted ? null : row.attachments,
    replyToId: row.reply_to_id ? String(row.reply_to_id) : null,
    replyTo: reply
      ? {
          id: String(reply.id),
          senderName: reply.senderName,
          content: reply.deleted ? '' : reply.content || '',
          hasAttachments: !!reply.hasAttachments && !reply.deleted,
          deleted: !!reply.deleted
        }
      : null,
    reactions: deleted ? [] : row.reactions || [],
    meta: row.meta,
    status: row.status,
    deleted,
    editedAt: row.edited_at ? new Date(row.edited_at).toISOString() : null,
    pinnedAt: row.pinned_at && !deleted ? new Date(row.pinned_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString()
  }
}

export function mapSummaryRow(row: any): ConversationSummary {
  const muted = row.muted_until && new Date(row.muted_until).getTime() > Date.now()
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    avatarUrl: row.avatar_url,
    studyGroupId: row.study_group_id ?? null,
    members: (row.members || []) as ChatUser[],
    memberCount: row.member_count,
    myRole: row.my_role,
    lastMessage: row.last_message ? mapMessageRow(row.last_message) : null,
    lastMessageAt: row.last_message_at ? new Date(row.last_message_at).toISOString() : null,
    unreadCount: row.unread_count,
    lastReadMessageId: String(row.last_read_message_id),
    readCursors: row.read_cursors || {},
    mutedUntil: muted ? new Date(row.muted_until).toISOString() : null,
    pinnedAt: row.pinned_at ? new Date(row.pinned_at).toISOString() : null
  }
}

export function mapMemberRow(row: any): ChatMember {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    isBot: row.account_type === 'bot',
    role: row.role,
    lastReadMessageId: String(row.last_read_message_id),
    joinedAt: new Date(row.joined_at).toISOString()
  }
}

// Câu SELECT tóm tắt hội thoại cho người xem (alias me = thành viên là mình)
export const SUMMARY_SELECT = `
  SELECT c.id, c.type, c.title, c.avatar_url, c.study_group_id, c.last_message_at, c.created_at,
         me.last_read_message_id, me.role AS my_role, me.muted_until, me.pinned_at,
         (SELECT COUNT(*) FROM conversation_members x WHERE x.conversation_id = c.id AND x.left_at IS NULL)::int AS member_count,
         (SELECT COUNT(*) FROM messages um
          WHERE um.conversation_id = c.id AND um.id > me.last_read_message_id
            AND um.deleted_at IS NULL AND um.kind <> 'system' AND um.sender_id IS DISTINCT FROM me.user_id)::int AS unread_count,
         COALESCE((SELECT json_agg(json_build_object('id', u.id, 'username', u.username, 'displayName', u.display_name,
                                                      'avatarUrl', u.avatar_url, 'isBot', u.account_type = 'bot'))
                   FROM (SELECT u.* FROM conversation_members o JOIN users u ON u.id = o.user_id
                         WHERE o.conversation_id = c.id AND o.user_id <> me.user_id AND o.left_at IS NULL
                         ORDER BY o.joined_at LIMIT 8) u), '[]'::json) AS members,
         (SELECT json_object_agg(o.user_id, o.last_read_message_id::text) FROM conversation_members o
          WHERE o.conversation_id = c.id AND o.user_id <> me.user_id AND o.left_at IS NULL AND c.type <> 'ai') AS read_cursors,
         lm.row AS last_message
  FROM conversation_members me
  JOIN conversations c ON c.id = me.conversation_id
  LEFT JOIN LATERAL (
    SELECT row_to_json(t) AS row FROM (SELECT ${MESSAGE_COLUMNS} ${MESSAGE_FROM} WHERE m.id = c.last_message_id) t
  ) lm ON TRUE`
