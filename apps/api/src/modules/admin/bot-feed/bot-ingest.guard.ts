import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { timingSafeEqual } from 'node:crypto'

// Xác thực tool crawl bằng secret dùng chung (BOT_INGEST_TOKEN); chưa cấu hình ⇒ tắt endpoint
@Injectable()
export class BotIngestGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.BOT_INGEST_TOKEN
    if (!expected) throw new ServiceUnavailableException('Chưa cấu hình BOT_INGEST_TOKEN')
    const given = String(context.switchToHttp().getRequest().headers['x-bot-ingest-token'] ?? '')
    const a = Buffer.from(given)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException('Token không hợp lệ')
    return true
  }
}
