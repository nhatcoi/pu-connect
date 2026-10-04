import { io, type Socket } from 'socket.io-client'

// Socket.IO dùng chung toàn app; xác thực bằng cookie pu_session (cùng origin, qua /api)
// Single shared connection — server assigns rooms, client only listens
let socket: Socket | null = null

export function getRealtimeSocket(): Socket {
  if (!socket) {
    socket = io({
      path: '/api/socket.io',
      addTrailingSlash: false, // khớp server; tránh redirect 308 của Next.js
      withCredentials: true,
      autoConnect: false,
      reconnectionDelayMax: 10_000
    })
    // Báo server tab đang hiện/ẩn ⇒ worker bỏ qua Web Push khi người dùng đang xem app
    const reportPresence = () => socket?.emit('presence', { visible: document.visibilityState === 'visible' })
    socket.on('connect', reportPresence)
    document.addEventListener('visibilitychange', reportPresence)
  }
  return socket
}

export function disconnectRealtime() {
  socket?.disconnect()
  socket = null
}
