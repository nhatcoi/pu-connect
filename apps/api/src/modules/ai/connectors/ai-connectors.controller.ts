import { Controller, Delete, Get, Query, Req, Res, UseGuards } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request, Response } from 'express'
import { requireUserId } from '../../../common/http/current-user'
import { AuthenticatedGuard } from '../../auth/guards/authenticated.guard'
import { AiConnectorsService } from './ai-connectors.service'
import { GoogleDriveService } from './google-drive.service'

declare module 'express-session' {
  interface SessionData {
    driveOAuthState?: string
  }
}

// Connector PU AI: danh sách + kết nối / ngắt Google Drive (OAuth redirect flow, state lưu session)
@Controller('ai/connectors')
@UseGuards(AuthenticatedGuard)
export class AiConnectorsController {
  private readonly appUrl: string

  constructor(
    private readonly connectors: AiConnectorsService,
    private readonly drive: GoogleDriveService,
    config: ConfigService
  ) {
    this.appUrl = (config.get<string>('APP_URL') || '').replace(/\/+$/, '')
  }

  @Get()
  list(@Req() req: Request) {
    return this.connectors.list(requireUserId(req))
  }

  // Chuyển sang màn đồng ý của Google
  @Get('google-drive/connect')
  connect(@Req() req: Request, @Res() res: Response) {
    const { url, state } = this.drive.authorizeUrl()
    req.session.driveOAuthState = state
    req.session.save(() => res.redirect(url))
  }

  // Google gọi lại: kiểm state (CSRF) ⇒ lưu token ⇒ về trang tin nhắn kèm kết quả
  @Get('google-drive/callback')
  async callback(@Query('code') code: string | undefined, @Query('state') state: string | undefined, @Req() req: Request, @Res() res: Response) {
    const expected = req.session.driveOAuthState
    req.session.driveOAuthState = undefined
    let result = 'connected'
    try {
      if (!code || !state || state !== expected) throw new Error('state')
      await this.drive.connect(requireUserId(req), code)
    } catch {
      result = 'error'
    }
    res.redirect(`${this.appUrl}/messages?drive=${result}`)
  }

  @Delete('google-drive')
  async disconnect(@Req() req: Request) {
    await this.drive.disconnect(requireUserId(req))
    return { disconnected: true }
  }
}
