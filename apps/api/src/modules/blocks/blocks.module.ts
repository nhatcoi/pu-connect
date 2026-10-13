import { Module } from '@nestjs/common'
import { RealtimeModule } from '../realtime/realtime.module'
import { BlocksController } from './blocks.controller'
import { BlocksService } from './blocks.service'

// Chặn người dùng; module khác chỉ cần blocks.sql.ts (không phụ thuộc service)
@Module({
  imports: [RealtimeModule],
  controllers: [BlocksController],
  providers: [BlocksService],
  exports: [BlocksService]
})
export class BlocksModule {}
