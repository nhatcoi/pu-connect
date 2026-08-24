import { Injectable, Logger } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'

export interface NotificationItem {
  id: string
  recipientId: string
  actorId: string | null
  actor?: {
    id: string
    username: string
    displayName: string
    avatarUrl?: string | null
  } | null
  type: string
  title: string
  message: string
  entityId?: string | null
  entityType?: string | null
  isRead: boolean
  createdAt: string
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(private readonly db: DatabaseService) {}

  async findAll(recipientId: string, limit = 15): Promise<{ data: NotificationItem[]; unreadCount: number }> {
    const safeLimit = Math.min(50, Math.max(1, limit))

    // 1. Get unread count
    const unreadRes = await this.db.query(
      `SELECT COUNT(*) as count FROM notifications WHERE recipient_id = $1 AND is_read = FALSE`,
      [recipientId]
    )
    const unreadCount = parseInt(unreadRes.rows[0]?.count || '0', 10)

    // 2. Get notifications with actor info
    const sql = `
      SELECT n.*,
             u.username as actor_username,
             u.display_name as actor_display_name,
             u.avatar_url as actor_avatar_url
      FROM notifications n
      LEFT JOIN users u ON n.actor_id = u.id
      WHERE n.recipient_id = $1
      ORDER BY n.created_at DESC
      LIMIT $2
    `
    const res = await this.db.query(sql, [recipientId, safeLimit])

    const items: NotificationItem[] = res.rows.map((row) => ({
      id: row.id,
      recipientId: row.recipient_id,
      actorId: row.actor_id,
      actor: row.actor_id
        ? {
            id: row.actor_id,
            username: row.actor_username || 'user',
            displayName: row.actor_display_name || 'Người dùng Phenikaa',
            avatarUrl: row.actor_avatar_url || null
          }
        : null,
      type: row.type,
      title: row.title,
      message: row.message,
      entityId: row.entity_id,
      entityType: row.entity_type,
      isRead: row.is_read || false,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
    }))

    return {
      data: items,
      unreadCount
    }
  }

  async markAsRead(id: string, recipientId: string): Promise<{ success: boolean }> {
    await this.db.query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND recipient_id = $2`,
      [id, recipientId]
    )
    return { success: true }
  }

  async markAllAsRead(recipientId: string): Promise<{ success: boolean }> {
    await this.db.query(
      `UPDATE notifications SET is_read = TRUE WHERE recipient_id = $1 AND is_read = FALSE`,
      [recipientId]
    )
    return { success: true }
  }

  async createNotification(data: {
    recipientId: string
    actorId?: string | null
    type: string
    title: string
    message: string
    entityId?: string | null
    entityType?: string | null
  }): Promise<void> {
    if (data.actorId && data.actorId === data.recipientId) {
      // Don't notify self
      return
    }

    await this.db.query(
      `INSERT INTO notifications (recipient_id, actor_id, type, title, message, entity_id, entity_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        data.recipientId,
        data.actorId || null,
        data.type,
        data.title,
        data.message,
        data.entityId || null,
        data.entityType || null
      ]
    )
  }
}
