'use client'

import React, { useCallback, useEffect } from 'react'
import { create } from 'zustand'
import { toast } from 'sonner'
import { MarkdownPreview } from '@/components/renderer/markdown-preview'
import { apiClient } from '@/lib/api-client'
import { useAppStore } from '@/store'
import { useRealtimeEvent } from '@/hooks/use-realtime-event'

export type NotificationType =
  'post_like' | 'post_comment' | 'comment_reply' | 'user_mention' | 'user_follow' | 'accepted_solution' | 'account_verified' | 'account_notice' | 'ai_reply'

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  message: string
  link: string | null
  entityId: string | null
  entityType: string | null
  actorsCount: number
  actor: { id: string; username: string; displayName: string; avatarUrl: string | null } | null
  isRead: boolean
  createdAt: string
  updatedAt: string
}

export interface NotificationSettings {
  inApp: Record<string, boolean>
  push: Record<string, boolean>
  quietHours: { enabled: boolean; start: string; end: string }
}

export interface NotificationSettingsPatch {
  inApp?: Record<string, boolean>
  push?: Record<string, boolean>
  quietHours?: Partial<NotificationSettings['quietHours']>
}

interface ListResponse {
  data: NotificationItem[]
  unreadCount: number
  nextCursor: string | null
}

// Store dùng chung: chuông (popover) + trang /notifications + sự kiện realtime
interface NotificationsState {
  items: NotificationItem[]
  unreadCount: number
  loaded: boolean
  upsert: (item: NotificationItem, unreadCount: number) => void
  setList: (items: NotificationItem[], unreadCount: number) => void
  markRead: (ids: string[] | 'all', unreadCount: number) => void
}

export const useNotificationsStore = create<NotificationsState>()((set) => ({
  items: [],
  unreadCount: 0,
  loaded: false,
  // Thông báo gộp có cùng id ⇒ thay thế và đưa lên đầu
  upsert: (item, unreadCount) => set((s) => ({ items: [item, ...s.items.filter((n) => n.id !== item.id)].slice(0, 30), unreadCount })),
  setList: (items, unreadCount) => set({ items, unreadCount, loaded: true }),
  markRead: (ids, unreadCount) =>
    set((s) => ({
      items: s.items.map((n) => (ids === 'all' || ids.includes(n.id) ? { ...n, isRead: true } : n)),
      unreadCount
    }))
}))

export const notificationsApi = {
  list: (params: { limit?: number; before?: string | null; unread?: boolean; type?: string } = {}) => {
    const q = new URLSearchParams()
    q.set('limit', String(params.limit ?? 15))
    if (params.before) q.set('before', params.before)
    if (params.unread) q.set('unread', '1')
    if (params.type) q.set('type', params.type)
    return apiClient<ListResponse>(`/notifications?${q.toString()}`)
  },
  markRead: (id: string) => apiClient<{ data: { unreadCount: number } }>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => apiClient<{ data: { unreadCount: number } }>('/notifications/read-all', { method: 'PATCH' }),
  getSettings: () => apiClient<{ data: NotificationSettings }>('/notifications/settings'),
  updateSettings: (patch: NotificationSettingsPatch) =>
    apiClient<{ data: NotificationSettings }>('/notifications/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch)
    })
}

// Gắn một lần ở Header: tải danh sách đầu, nghe realtime, đồng bộ đã đọc giữa các tab
export function useNotificationsSync(onNavigate: (link: string) => void) {
  const userId = useAppStore((s) => s.user?.id)
  const { setList, upsert, markRead } = useNotificationsStore.getState()

  const refresh = useCallback(async () => {
    try {
      const res = await notificationsApi.list({ limit: 15 })
      setList(res.data, res.unreadCount)
    } catch {
      // Lỗi mạng: giữ dữ liệu cũ
    }
  }, [setList])

  useEffect(() => {
    if (!userId) return
    refresh()
    // Dự phòng khi mất kết nối socket (fallback polling)
    const interval = setInterval(refresh, 120_000)
    return () => clearInterval(interval)
  }, [userId, refresh])

  useRealtimeEvent<{ notification: NotificationItem; unreadCount: number }>('notification', (payload) => {
    if (!payload?.notification) return refresh()
    upsert(payload.notification, payload.unreadCount)
    const { notification } = payload
    toast(notification.title, {
      description: notification.message
        ? React.createElement(MarkdownPreview, {
            content: notification.message,
            inline: true,
            className: 'line-clamp-2 text-xs text-muted-foreground'
          })
        : undefined,
      action: notification.link ? { label: 'Xem', onClick: () => onNavigate(notification.link as string) } : undefined
    })
  })

  useRealtimeEvent<{ ids?: string[]; all?: boolean; unreadCount: number }>('notification.read', (payload) => {
    markRead(payload.all ? 'all' : payload.ids || [], payload.unreadCount)
  })
}

// Đánh dấu đã đọc (lạc quan) rồi điều hướng
export async function openNotification(item: NotificationItem, navigate: (link: string) => void) {
  const store = useNotificationsStore.getState()
  if (!item.isRead) {
    store.markRead([item.id], Math.max(0, store.unreadCount - 1))
    notificationsApi.markRead(item.id).catch(() => undefined)
  }
  if (item.link) navigate(item.link)
}
