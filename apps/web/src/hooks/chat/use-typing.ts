'use client'

import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import type { ChatUser, TypingEvent } from '@pu/schemas'
import { getRealtimeSocket } from '@/lib/realtime'

// Ai đang nhập ở hội thoại nào (tự hết hạn sau 5s nếu mất sự kiện dừng)
type TypingState = { typing: Record<string, Record<string, number>>; set: (e: TypingEvent) => void }
export const useTypingStore = create<TypingState>()((set) => ({
  typing: {},
  set: (e) =>
    set((s) => {
      const conv = { ...(s.typing[e.conversationId] || {}) }
      if (e.isTyping) conv[e.userId] = Date.now() + 5000
      else delete conv[e.userId]
      return { typing: { ...s.typing, [e.conversationId]: conv } }
    })
}))

// "Mai đang nhập…" (bỏ qua mục đã hết hạn)
export function useTypingLabel(conversationId: string, members: ChatUser[], myId?: string): string | null {
  const entries = useTypingStore((s) => s.typing[conversationId])
  const [, tick] = useState(0)
  // Chỉ chạy khi có ai đó đang nhập (để mục hết hạn tự biến mất); không ai nhập thì không render lại mỗi 2 giây
  const active = !!entries && Object.keys(entries).length > 0
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => tick((n) => n + 1), 2000)
    return () => clearInterval(t)
  }, [active])
  const now = Date.now()
  const ids = Object.entries(entries || {})
    .filter(([uid, exp]) => uid !== myId && exp > now)
    .map(([uid]) => uid)
  if (!ids.length) return null
  const names = ids.map((uid) => members.find((m) => m.id === uid)?.displayName || 'Ai đó')
  return `${names.join(', ')} đang nhập…`
}

// Báo "đang nhập" (tối đa 1 lần / 3s, tự dừng sau 4s không gõ)
export function useTypingEmitter(conversationId: string) {
  const lastSent = useRef(0)
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const emit = (isTyping: boolean) => getRealtimeSocket().emit('typing', { conversationId, isTyping })

  useEffect(
    () => () => {
      if (stopTimer.current) clearTimeout(stopTimer.current)
    },
    []
  )

  return {
    onInput: () => {
      const now = Date.now()
      if (now - lastSent.current > 3000) {
        lastSent.current = now
        emit(true)
      }
      if (stopTimer.current) clearTimeout(stopTimer.current)
      stopTimer.current = setTimeout(() => {
        lastSent.current = 0
        emit(false)
      }, 4000)
    },
    stop: () => {
      if (stopTimer.current) clearTimeout(stopTimer.current)
      if (lastSent.current) emit(false)
      lastSent.current = 0
    }
  }
}
