import * as session from 'express-session'
import * as connectPgSimple from 'connect-pg-simple'
import type { RequestHandler } from 'express'
import type { Pool } from 'pg'

const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7 // 7 ngày

let sessionMiddleware: RequestHandler | null = null

// Session lưu trong Postgres (bảng user_sessions) ⇒ restart/deploy không đăng xuất người dùng
// Shared by HTTP (main.ts) and Socket.IO handshake (RealtimeGateway)
export function createSessionMiddleware(pool: Pool): RequestHandler {
  const secret = process.env.SESSION_SECRET
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is required in production')
  }

  const PgStore = connectPgSimple(session)
  sessionMiddleware = session({
    name: 'pu_session',
    secret: secret || 'pu-connector-dev-session-secret',
    store: new PgStore({
      pool,
      tableName: 'user_sessions',
      createTableIfMissing: false, // bảng tạo bởi messaging-upgrade.sql
      pruneSessionInterval: 60 * 15
    }),
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      maxAge: SESSION_MAX_AGE_MS,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    }
  })
  return sessionMiddleware
}

export function getSessionMiddleware(): RequestHandler {
  if (!sessionMiddleware) throw new Error('Session middleware not initialized')
  return sessionMiddleware
}
