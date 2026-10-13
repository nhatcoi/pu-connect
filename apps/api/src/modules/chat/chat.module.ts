import { Module } from '@nestjs/common'
import { RealtimeModule } from '../realtime/realtime.module'
import { StorageModule } from '../storage/storage.module'
import { ChatCoreService } from './chat-core.service'
import { ConversationsController } from './conversations/conversations.controller'
import { ConversationsService } from './conversations/conversations.service'
import { StudyGroupChatService } from './conversations/study-group-chat.service'
import { MessagesController } from './messages/messages.controller'
import { MessagesService } from './messages/messages.service'
import { PuaiController } from './puai/puai.controller'
import { PuaiRetrieval } from './puai/puai.retrieval'
import { PuaiService } from './puai/puai.service'

// Nhắn tin (Domain 10) + PU AI (Domain 13)
// core ← puai ← conversations ← study-group-chat / messages (không vòng phụ thuộc)
// StudyGroupsModule dùng StudyGroupChatService (chat không phụ thuộc ngược lại)
@Module({
  imports: [RealtimeModule, StorageModule],
  controllers: [ConversationsController, MessagesController, PuaiController],
  providers: [ChatCoreService, PuaiRetrieval, PuaiService, ConversationsService, StudyGroupChatService, MessagesService],
  exports: [ConversationsService, StudyGroupChatService]
})
export class ChatModule {}
