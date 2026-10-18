import { Controller, Get, Param } from '@nestjs/common'
import { AiThreadShareService } from './ai-thread-share.service'

// Trang công khai của hội thoại N7AI được chia sẻ — không cần đăng nhập (token 128-bit khó đoán)
@Controller('ai/shared')
export class AiSharedController {
  constructor(private readonly shares: AiThreadShareService) {}

  @Get(':token')
  view(@Param('token') token: string) {
    return this.shares.view(token)
  }
}
