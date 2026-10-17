import { Injectable, type NestMiddleware } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { NextFunction, Request, Response } from 'express'
import { GOOGLE_PROVIDERS, GoogleOAuthService, type GoogleProvider } from './google-oauth.service'

declare module 'express-session' {
  interface SessionData {
    connectorOAuth?: { state: string; provider: GoogleProvider }
  }
}

// Hoàn tất OAuth connector: kiểm state (CSRF, dùng 1 lần) ⇒ đổi code lấy token ⇒ URL về trang tin nhắn kèm kết quả
export async function completeConnectorOAuth(req: Request, oauth: GoogleOAuthService, appUrl: string): Promise<string> {
  const pending = req.session.connectorOAuth
  req.session.connectorOAuth = undefined
  const { code, state } = req.query as { code?: string; state?: string }
  const userId = (req.user as { id?: string } | undefined)?.id
  let result = 'error'
  if (pending && code && state === pending.state && userId) {
    try {
      await oauth.connect(userId, pending.provider, code)
      result = 'connected'
    } catch {
      // result = error
    }
  }
  const slug = pending ? GOOGLE_PROVIDERS[pending.provider].slug : 'google'
  return `${appUrl}/n7ai/settings/connectors?connector=${slug}&result=${result}`
}

// Connector dùng chung redirect URI với đăng nhập Google (không phải khai báo URI mới trên Google Console):
// state khớp phiên connector đang chờ ⇒ xử lý ở đây; còn lại ⇒ để luồng đăng nhập (passport) chạy tiếp
@Injectable()
export class ConnectorCallbackMiddleware implements NestMiddleware {
  private readonly appUrl: string

  constructor(
    private readonly oauth: GoogleOAuthService,
    config: ConfigService
  ) {
    this.appUrl = (config.get<string>('APP_URL') || '').replace(/\/+$/, '')
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const pending = req.session?.connectorOAuth
    if (!pending || req.query.state !== pending.state) return next()
    res.redirect(await completeConnectorOAuth(req, this.oauth, this.appUrl))
  }
}
