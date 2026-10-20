import { Controller, Delete, Get, Req, Res, UseGuards } from '@nestjs/common'
import type { Request, Response } from 'express'
import { requireUserId } from '../../../common/http/current-user'
import { AuthenticatedGuard } from '../../auth/guards/authenticated.guard'
import { PuConnectorService, type PuConnectorPending } from './pu-connector.service'

declare module 'express-session' {
  interface SessionData {
    puConnector?: PuConnectorPending
  }
}

@Controller('ai/connectors/pu-connector')
@UseGuards(AuthenticatedGuard)
export class PuConnectorController {
  constructor(private readonly connector: PuConnectorService) {}

  @Get('connect')
  connect(@Req() req: Request, @Res() res: Response) {
    const { pending, url } = this.connector.begin(requireUserId(req))
    req.session.puConnector = pending
    req.session.save((error) => (error ? res.status(503).send('Chưa mở được kết nối. Thử lại nhé.') : res.redirect(url)))
  }

  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response) {
    const pending = req.session.puConnector
    delete req.session.puConnector
    await new Promise<void>((resolve, reject) => req.session.save((error) => (error ? reject(error) : resolve())))
    let result = 'error'
    if (pending) {
      try {
        await this.connector.complete(requireUserId(req), pending, req.query.state, req.query.code)
        result = 'connected'
      } catch {
        /* Return a concise reconnect result; no university credentials in redirects. */
      }
    }
    res.redirect(`/n7ai/settings/connectors?connector=pu-connector&result=${result}`)
  }

  @Delete()
  async disconnect(@Req() req: Request) {
    await this.connector.disconnect(requireUserId(req))
    return { disconnected: true }
  }
}
