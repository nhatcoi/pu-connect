'use client'

import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import { getRealtimeSocket } from '@/lib/realtime'

// Lắng nghe một sự kiện realtime khi đã đăng nhập (tự kết nối socket)
// Subscribe to a server event; connects lazily once the user is logged in
export function useRealtimeEvent<T = unknown>(event: string, handler: (payload: T) => void) {
  const userId = useAppStore((state) => state.user?.id)
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!userId) return
    const socket = getRealtimeSocket()
    const listener = (payload: T) => handlerRef.current(payload)
    socket.on(event, listener)
    if (!socket.connected) socket.connect()
    return () => {
      socket.off(event, listener)
    }
  }, [event, userId])
}
