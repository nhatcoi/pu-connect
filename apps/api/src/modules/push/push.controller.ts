import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Post, Req } from '@nestjs/common'
import type { Request } from 'express'
import { requireUserId } from '../../common/http/current-user'
import { SimpleRateLimiter } from '../auth/rate-limit.util'
import { PushService, type SubscriptionInput } from './push.service'

const testLimiter = new SimpleRateLimiter(5, 10 * 60_000)

function parseSubscription(body: any): SubscriptionInput {
  const endpoint = body?.endpoint
  const p256dh = body?.keys?.p256dh
  const auth = body?.keys?.auth
  // Chỉ chấp nhận endpoint HTTPS hợp lệ của push service
  if (typeof endpoint !== 'string' || !/^https:\/\/[^\s]{10,1000}$/.test(endpoint)) {
    throw new BadRequestException('Đăng ký push không hợp lệ')
  }
  if (typeof p256dh !== 'string' || typeof auth !== 'string' || p256dh.length > 255 || auth.length > 255) {
    throw new BadRequestException('Khóa đăng ký push không hợp lệ')
  }
  return { endpoint, keys: { p256dh, auth } }
}

@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  // Public key VAPID cho trình duyệt (không phải bí mật)
  @Get('config')
  config() {
    return { success: true, data: this.push.getConfig() }
  }

  @Post('subscriptions')
  @HttpCode(201)
  async subscribe(@Req() req: Request, @Body() body: unknown) {
    const userId = requireUserId(req)
    await this.push.subscribe(userId, parseSubscription(body), req.headers['user-agent'])
    return { success: true }
  }

  @Delete('subscriptions')
  async unsubscribe(@Req() req: Request, @Body() body: { endpoint?: string }) {
    const userId = requireUserId(req)
    if (typeof body?.endpoint !== 'string') throw new BadRequestException('Thiếu endpoint')
    await this.push.unsubscribe(userId, body.endpoint)
    return { success: true }
  }

  // Gửi thử tới mọi trình duyệt của chính mình (bỏ qua delay/giờ yên tĩnh)
  @Post('test')
  async test(@Req() req: Request) {
    const userId = requireUserId(req)
    testLimiter.consume(userId)
    if (!this.push.isEnabled()) throw new BadRequestException('Web Push chưa được cấu hình trên máy chủ')
    const result = await this.push.sendToUser(
      userId,
      {
        title: 'PU Connector',
        body: 'Thông báo trên trình duyệt đã hoạt động 🎉',
        url: '/notifications',
        tag: 'push-test'
      },
      'high'
    )
    return { success: true, data: result }
  }
}
