import { Module } from '@nestjs/common'
import { NotificationsModule } from '../notifications/notifications.module'
import { PersonalizationModule } from '../personalization/personalization.module'
import { RealtimeModule } from '../realtime/realtime.module'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'
import { AdminUsersService } from './admin-users.service'
import { AdminListsService } from './admin-lists.service'
import { AdminViewsService } from './admin-views.service'
import { AdminRiskService } from './admin-risk.service'
import { AdminGuard } from './admin.guard'

@Module({
  imports: [RealtimeModule, PersonalizationModule, NotificationsModule],
  controllers: [AdminController],
  providers: [AdminService, AdminUsersService, AdminListsService, AdminViewsService, AdminRiskService, AdminGuard]
})
export class AdminModule {}
