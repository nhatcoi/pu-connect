import { Module } from '@nestjs/common'
import { CommunitiesController } from './communities.controller'
import { CommunitiesService } from './communities.service'
import { CommunityManagementService } from './community-management.service'
import { DatabaseModule } from '../../database/database.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { AiModule } from '../ai/ai.module'
import { ChatModule } from '../chat/chat.module'
import { CommunityExtrasService } from './community-extras.service'

@Module({
  imports: [DatabaseModule, NotificationsModule, AiModule, ChatModule],
  controllers: [CommunitiesController],
  providers: [CommunitiesService, CommunityManagementService, CommunityExtrasService],
  exports: [CommunitiesService]
})
export class CommunitiesModule {}
