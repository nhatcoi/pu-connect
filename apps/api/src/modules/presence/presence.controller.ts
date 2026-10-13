import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { requireUserId } from '../../common/http/current-user'
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard'
import { PresenceService } from './presence.service'

@Controller('presence')
@UseGuards(AuthenticatedGuard)
export class PresenceController {
  constructor(private readonly presence: PresenceService) {}

  // { [userId]: { online, lastSeenAt } } của người cùng hội thoại
  @Get()
  contacts(@Req() req: Request) {
    return this.presence.contacts(requireUserId(req))
  }
}
