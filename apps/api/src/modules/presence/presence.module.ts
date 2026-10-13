import { Module } from '@nestjs/common'
import { RealtimeModule } from '../realtime/realtime.module'
import { PresenceController } from './presence.controller'
import { PresenceService } from './presence.service'

// Trạng thái hoạt động: gateway đếm kết nối, PresenceService quyết định ai được thấy
@Module({
  imports: [RealtimeModule],
  controllers: [PresenceController],
  providers: [PresenceService]
})
export class PresenceModule {}
