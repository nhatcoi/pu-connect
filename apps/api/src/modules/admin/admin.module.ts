import { Module } from '@nestjs/common'
import { AiModule } from '../ai/ai.module'
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
import { AdminAiModelsController } from './admin-ai-models.controller'
import { AdminAiModelsService } from './admin-ai-models.service'
import { AdminAiProvidersController } from './admin-ai-providers.controller'
import { AdminAiProvidersService } from './admin-ai-providers.service'
import { AdminAiServicesController } from './admin-ai-services.controller'
import { AdminUnitsController } from './admin-units.controller'
import { AdminUnitsService } from './admin-units.service'
import { BotIngestController } from './bot-import/bot-ingest.controller'
import { BotImageUploadService } from './bot-import/bot-image-upload.service'
import { BotImportService } from './bot-import/bot-import.service'
import { BotIngestGuard } from './bot-import/bot-ingest.guard'
import { StorageModule } from '../storage/storage.module'
import { AdminNewsController } from './admin-news.controller'
import { AdminNewsService } from './admin-news.service'
import { AdminBotsController } from './admin-bots.controller'
import { AdminBotsService } from './admin-bots.service'
import { AdminGuard } from './admin.guard'

@Module({
  imports: [RealtimeModule, PersonalizationModule, NotificationsModule, AuthModule, StorageModule, AiModule],
  controllers: [AdminController, AdminBotsController, AdminNewsController, BotIngestController, AdminUnitsController, AdminAiModelsController, AdminAiProvidersController, AdminAiServicesController],
  providers: [AdminService, AdminUsersService, AdminListsService, AdminViewsService, AdminUserDataService, AdminRiskService, AdminBotsService, AdminNewsService, BotImageUploadService, BotImportService, BotIngestGuard, AdminUnitsService, AdminAiModelsService, AdminAiProvidersService, AdminGuard]
})
export class AdminModule {}
