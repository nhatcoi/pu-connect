import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { PersonalizationModule } from '../personalization/personalization.module'
import { RealtimeModule } from '../realtime/realtime.module'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'
import { AdminUsersService } from './admin-users.service'
import { AdminListsService } from './admin-lists.service'
import { AdminViewsService } from './admin-views.service'
import { AdminUserDataService } from './admin-user-data.service'
import { AdminRiskService } from './admin-risk.service'
import { AdminBotsController } from './admin-bots.controller'
import { AdminBotsService } from './admin-bots.service'
import { AdminGuard } from './admin.guard'

@Module({
  imports: [RealtimeModule, PersonalizationModule, NotificationsModule, AuthModule],
  controllers: [AdminController, AdminBotsController],
  providers: [AdminService, AdminUsersService, AdminListsService, AdminViewsService, AdminUserDataService, AdminRiskService, AdminBotsService, AdminGuard]
})
export class AdminModule {}
