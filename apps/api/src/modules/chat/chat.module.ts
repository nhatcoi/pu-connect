import { Module } from '@nestjs/common'
import { RealtimeModule } from '../realtime/realtime.module'
import { ChatController } from './chat.controller'
import { ChatService } from './chat.service'
import { PuaiService } from './puai.service'

@Module({
  imports: [RealtimeModule],
  controllers: [ChatController],
  providers: [ChatService, PuaiService],
  exports: [ChatService]
})
export class ChatModule {}
