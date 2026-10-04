import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req } from '@nestjs/common'
import type { Request } from 'express'
import { NotificationsService } from './notifications.service'
import { requireUserId } from '../../common/http/current-user'

const LOGIN_MESSAGE = 'Vui lòng đăng nhập để xem thông báo'

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // GET /notifications?limit=15&before=<cursor>&unread=1&type=user_mention
  @Get()
  async findAll(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('unread') unread?: string,
    @Query('type') type?: string
  ) {
    const userId = requireUserId(req, LOGIN_MESSAGE)
    const result = await this.notificationsService.findAll(userId, {
      limit: limit ? parseInt(limit, 10) : 15,
      before,
      unreadOnly: unread === '1' || unread === 'true',
      type
    })
    return { success: true, ...result }
  }

  @Get('unread-count')
  async unreadCount(@Req() req: Request) {
    const userId = requireUserId(req, LOGIN_MESSAGE)
    return { success: true, unreadCount: await this.notificationsService.unreadCount(userId) }
  }

  @Get('settings')
  async getSettings(@Req() req: Request) {
    const userId = requireUserId(req, LOGIN_MESSAGE)
    return { success: true, data: await this.notificationsService.getSettings(userId) }
  }

  @Patch('settings')
  async updateSettings(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const userId = requireUserId(req, LOGIN_MESSAGE)
    return { success: true, data: await this.notificationsService.updateSettings(userId, body) }
  }

  @Patch('read-all')
  async markAllAsRead(@Req() req: Request) {
    return this.notificationsService.markAllAsRead(requireUserId(req, LOGIN_MESSAGE))
  }

  @Patch(':id/read')
  async markAsRead(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.notificationsService.markAsRead(id, requireUserId(req, LOGIN_MESSAGE))
  }
}
