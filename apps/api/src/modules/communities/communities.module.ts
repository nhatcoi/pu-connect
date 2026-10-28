import { Module } from '@nestjs/common'
import { CommunitiesController } from './communities.controller'
import { CommunitiesService } from './communities.service'
import { CommunityManagementService } from './community-management.service'
import { DatabaseModule } from '../../database/database.module'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [DatabaseModule, NotificationsModule],
  controllers: [CommunitiesController],
  providers: [CommunitiesService, CommunityManagementService],
  exports: [CommunitiesService]
})
export class CommunitiesModule {}
