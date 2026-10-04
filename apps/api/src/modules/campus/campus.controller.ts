import { Controller, Get, Post, Body, Req } from '@nestjs/common'
import type { Request } from 'express'
import { requireRole } from '../../common/http/current-user'
import { CampusService } from './campus.service'
import type { CampusEvent } from '@pu/schemas'

@Controller('campus-events')
export class CampusController {
  constructor(private readonly campusService: CampusService) {}

  @Get()
  async findAllEvents() {
    return this.campusService.findAllEvents()
  }

  @Post()
  async createEvent(@Body() data: Omit<CampusEvent, 'id' | 'attendeesCount'>, @Req() req: Request) {
    requireRole(req, ['admin', 'lecturer', 'club_lead'])
    return this.campusService.createEvent(data)
  }
}
