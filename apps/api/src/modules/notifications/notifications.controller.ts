import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Req,
  UnauthorizedException
} from '@nestjs/common'
import { NotificationsService } from './notifications.service'
import { DatabaseService } from '../../database/database.service'
import type { Request } from 'express'

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly db: DatabaseService
  ) {}

  private async resolveUserId(req: Request): Promise<string> {
    let userId = (req.user as any)?.id
    if (!userId) {
      const fallbackUser = await this.db.query(
        `SELECT id FROM users WHERE status = 'active' ORDER BY created_at ASC LIMIT 1`
      )
      userId = fallbackUser.rows[0]?.id
    }
    if (!userId) {
      throw new UnauthorizedException('Vui lòng đăng nhập để xem thông báo')
    }
    return userId
  }

  @Get()
  async findAll(@Query('limit') limit: string | undefined, @Req() req: Request) {
    const userId = await this.resolveUserId(req)
    const parsedLimit = limit ? parseInt(limit, 10) : 15
    const result = await this.notificationsService.findAll(userId, parsedLimit)
    return {
      success: true,
      data: result.data,
      unreadCount: result.unreadCount
    }
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Req() req: Request) {
    const userId = await this.resolveUserId(req)
    return this.notificationsService.markAsRead(id, userId)
  }

  @Patch('read-all')
  async markAllAsRead(@Req() req: Request) {
    const userId = await this.resolveUserId(req)
    return this.notificationsService.markAllAsRead(userId)
  }
}
