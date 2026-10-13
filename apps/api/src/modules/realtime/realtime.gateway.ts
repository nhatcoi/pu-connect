import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody
} from '@nestjs/websockets'
import { Logger } from '@nestjs/common'
import type { IncomingMessage, ServerResponse } from 'http'
import type { RequestHandler } from 'express'
import * as passport from 'passport'
import { Server, Socket } from 'socket.io'
import { getSessionMiddleware } from '../../common/http/session'
import { isAllowedOrigin } from '../../common/http/origins'
import { DatabaseService } from '../../database/database.service'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const REALTIME_PATH = '/api/socket.io'

type AuthedRequest = IncomingMessage & { user?: { id: string }; _query?: Record<string, string> }

// Chỉ chạy middleware ở handshake đầu tiên (request không có sid)
function onlyForHandshake(middleware: RequestHandler) {
  return (req: AuthedRequest, res: ServerResponse, next: (err?: unknown) => void) => {
    if (req._query?.sid === undefined) {
      middleware(req as any, res as any, next)
    } else {
      next()
    }
  }
}

// Gateway realtime: xác thực bằng cookie pu_session, room do server cấp (user:{id})
// Server-assigned rooms only — clients cannot join arbitrary rooms or spoof senders
@WebSocketGateway({
  path: REALTIME_PATH,
  addTrailingSlash: false, // Next.js rewrite bỏ dấu "/" cuối (308) ⇒ dùng path không slash
  cors: {
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) =>
      cb(null, isAllowedOrigin(origin)),
    credentials: true
  },
  // Chặn Cross-Site WebSocket Hijacking (CORS không áp dụng cho transport websocket)
  allowRequest: (req: IncomingMessage, cb: (err: string | null | undefined, ok: boolean) => void) =>
    cb(null, isAllowedOrigin(req.headers.origin))
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  server: Server

  private readonly logger = new Logger(RealtimeGateway.name)

  constructor(private readonly db: DatabaseService) {}

  afterInit(server: Server) {
    server.engine.use(onlyForHandshake(getSessionMiddleware()))
    server.engine.use(onlyForHandshake(passport.initialize() as RequestHandler))
    server.engine.use(onlyForHandshake(passport.session() as RequestHandler))

    // Từ chối socket không có phiên đăng nhập
    server.use((socket, next) => {
      const user = (socket.request as AuthedRequest).user
      if (!user?.id) return next(new Error('unauthorized'))
      next()
    })
  }

  handleConnection(socket: Socket) {
    const userId = (socket.request as AuthedRequest).user!.id
    socket.data.visible = true // client gửi 'presence' ngay sau khi kết nối
    socket.join(this.userRoom(userId))
  }

  // Tab đang hiển thị hay ẩn (document.visibilityState) — quyết định có cần Web Push không
  @SubscribeMessage('presence')
  handlePresence(@ConnectedSocket() socket: Socket, @MessageBody() body: { visible?: boolean }) {
    socket.data.visible = body?.visible === true
  }

  // Đang nhập tin: chỉ chuyển tới thành viên khác của hội thoại (server kiểm tra membership)
  @SubscribeMessage('typing')
  async handleTyping(@ConnectedSocket() socket: Socket, @MessageBody() body: { conversationId?: string; isTyping?: boolean }) {
    const userId = (socket.request as AuthedRequest).user?.id
    const conversationId = body?.conversationId
    if (!userId || typeof conversationId !== 'string' || !UUID_RE.test(conversationId)) return
    const res = await this.db.query(
      `SELECT o.user_id FROM conversation_members o
       WHERE o.conversation_id = $1 AND o.left_at IS NULL AND o.user_id <> $2
         AND EXISTS (SELECT 1 FROM conversation_members me WHERE me.conversation_id = $1 AND me.user_id = $2 AND me.left_at IS NULL)`,
      [conversationId, userId]
    )
    const payload = { conversationId, userId, isTyping: body.isTyping === true }
    for (const row of res.rows) this.emitToUser(row.user_id, 'typing', payload)
  }

  // User đang nhìn thấy app ở ít nhất một tab ⇒ không cần push
  async isUserActive(userId: string): Promise<boolean> {
    if (!this.server) return false
    const sockets = await this.server.in(this.userRoom(userId)).fetchSockets()
    return sockets.some((s) => s.data?.visible === true)
  }

  // Gửi sự kiện tới mọi tab/thiết bị của một user
  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(this.userRoom(userId)).emit(event, payload)
  }

  // Ngắt mọi socket của user (khi bị khóa tài khoản)
  disconnectUser(userId: string) {
    this.server?.in(this.userRoom(userId)).disconnectSockets(true)
  }

  private userRoom(userId: string) {
    return `user:${userId}`
  }
}
