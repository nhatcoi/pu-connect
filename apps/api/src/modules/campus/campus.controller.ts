import { Controller, Get, Post, Body } from '@nestjs/common'
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
  async createEvent(@Body() data: Omit<CampusEvent, 'id' | 'attendeesCount'>) {
    return this.campusService.createEvent(data)
  }
}
