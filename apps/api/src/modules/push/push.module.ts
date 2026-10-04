import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { RealtimeModule } from '../realtime/realtime.module'
import { PushController } from './push.controller'
import { PushProcessor } from './push.processor'
import { PushService } from './push.service'
import { PUSH_QUEUE } from './push.constants'

@Module({
  imports: [BullModule.registerQueue({ name: PUSH_QUEUE }), RealtimeModule],
  controllers: [PushController],
  providers: [PushService, PushProcessor],
  exports: [PushService]
})
export class PushModule {}
