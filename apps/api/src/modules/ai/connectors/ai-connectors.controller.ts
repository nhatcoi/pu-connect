import { BadRequestException, Controller, Delete, Get, Param, Query, Req, Res, UseGuards } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request, Response } from 'express'
import { requireUserId } from '../../../common/http/current-user'
import { AuthenticatedGuard } from '../../auth/guards/authenticated.guard'
import { AiConnectorsService } from './ai-connectors.service'
import { GOOGLE_PROVIDERS, GoogleOAuthService, providerFromSlug, type GoogleProvider } from './google-oauth.service'

declare module 'express-session' {
  interface SessionData {
    connectorOAuth?: { state: string; provider: GoogleProvider }
  }
}

// Connector PU AI: danh sách + kết nối / ngắt Google Drive, Google Calendar (OAuth redirect flow, state lưu session)
@Controller('ai/connectors')
@UseGuards(AuthenticatedGuard)
export class AiConnectorsController {
  private readonly appUrl: string

  constructor(
    private readonly connectors: AiConnectorsService,
    private readonly oauth: GoogleOAuthService,
    config: ConfigService
  ) {
    this.appUrl = (config.get<string>('APP_URL') || '').replace(/\/+$/, '')
  }

  @Get()
  list(@Req() req: Request) {
    return this.connectors.list(requireUserId(req))
  }

  // Google gọi lại (1 URI cho mọi provider): kiểm state (CSRF) ⇒ lưu token ⇒ về trang tin nhắn kèm kết quả
  @Get('google/callback')
  async callback(@Query('code') code: string | undefined, @Query('state') state: string | undefined, @Req() req: Request, @Res() res: Response) {
    const pending = req.session.connectorOAuth
    req.session.connectorOAuth = undefined
    let result = 'error'
    try {
      if (!code || !state || !pending || state !== pending.state) throw new Error('state')
      await this.oauth.connect(requireUserId(req), pending.provider, code)
      result = 'connected'
    } catch {
      // result = error
    }
    const slug = pending ? GOOGLE_PROVIDERS[pending.provider].slug : 'google'
    res.redirect(`${this.appUrl}/messages?connector=${slug}&result=${result}`)
  }

  // Chuyển sang màn đồng ý của Google (google-drive | google-calendar)
  @Get(':provider/connect')
  connect(@Param('provider') slug: string, @Req() req: Request, @Res() res: Response) {
    const provider = this.provider(slug)
    const { url, state } = this.oauth.authorizeUrl(provider)
    req.session.connectorOAuth = { state, provider }
    req.session.save(() => res.redirect(url))
  }

  @Delete(':provider')
  async disconnect(@Param('provider') slug: string, @Req() req: Request) {
    await this.oauth.disconnect(requireUserId(req), this.provider(slug))
    return { disconnected: true }
  }

  private provider(slug: string): GoogleProvider {
    const provider = providerFromSlug(slug)
    if (!provider) throw new BadRequestException('Connector không hợp lệ')
    return provider
  }
}
