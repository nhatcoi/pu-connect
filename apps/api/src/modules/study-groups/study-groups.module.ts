import { Module } from '@nestjs/common'
import { ChatModule } from '../chat/chat.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { StudyGroupsController } from './study-groups.controller'
import { StudyGroupsService } from './study-groups.service'

@Module({
  imports: [ChatModule, NotificationsModule],
  controllers: [StudyGroupsController],
  providers: [StudyGroupsService],
  exports: [StudyGroupsService]
})
export class StudyGroupsModule {}
