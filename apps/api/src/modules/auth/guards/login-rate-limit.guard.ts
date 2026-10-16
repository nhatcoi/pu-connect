import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import type { Request } from 'express'
import { SimpleRateLimiter } from '../rate-limit.util'

// Chống dò mật khẩu: chạy TRƯỚC LocalAuthGuard
// 10 lần / 15 phút cho mỗi (IP + tài khoản), 50 lần / 15 phút cho mỗi IP
const perAccount = new SimpleRateLimiter(10, 15 * 60_000)
const perIp = new SimpleRateLimiter(50, 15 * 60_000)

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>()
    const ip = req.ip || 'unknown'
    const account = String((req.body as { emailOrUsername?: string })?.emailOrUsername || '')
      .toLowerCase()
      .trim()
    perIp.consume(ip)
    perAccount.consume(`${ip}|${account}`)
    return true
  }
}
