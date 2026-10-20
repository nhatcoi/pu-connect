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
import { AdminUnitsController } from './admin-units.controller'
import { AdminUnitsService } from './admin-units.service'
import { BotIngestController } from './bot-import/bot-ingest.controller'
import { BotImageUploadService } from './bot-import/bot-image-upload.service'
import { BotImportService } from './bot-import/bot-import.service'
import { BotIngestGuard } from './bot-import/bot-ingest.guard'
import { StorageModule } from '../storage/storage.module'
import { AdminBotsController } from './admin-bots.controller'
import { AdminBotsService } from './admin-bots.service'
import { AdminGuard } from './admin.guard'

@Module({
  imports: [RealtimeModule, PersonalizationModule, NotificationsModule, AuthModule, StorageModule],
  controllers: [AdminController, AdminBotsController, BotIngestController, AdminUnitsController],
  providers: [AdminService, AdminUsersService, AdminListsService, AdminViewsService, AdminUserDataService, AdminRiskService, AdminBotsService, BotImageUploadService, BotImportService, BotIngestGuard, AdminUnitsService, AdminGuard]
})
export class AdminModule {}
