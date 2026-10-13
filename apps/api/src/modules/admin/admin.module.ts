import { Module } from '@nestjs/common'
import { RealtimeModule } from '../realtime/realtime.module'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'
import { AdminGuard } from './admin.guard'

@Module({
  imports: [RealtimeModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard]
})
export class AdminModule {}
