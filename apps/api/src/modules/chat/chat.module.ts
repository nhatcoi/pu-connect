import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { PushModule } from '../push/push.module'
import { RealtimeModule } from '../realtime/realtime.module'
import { StorageModule } from '../storage/storage.module'
import { ChatCoreService } from './chat-core.service'
import { ConversationsController } from './conversations/conversations.controller'
import { ConversationsService } from './conversations/conversations.service'
import { StudyGroupChatService } from './conversations/study-group-chat.service'
import { MessagesController } from './messages/messages.controller'
import { MessagesService } from './messages/messages.service'
import { CHAT_PUSH_QUEUE } from './notify/chat-push.constants'
import { ChatPushProcessor } from './notify/chat-push.processor'
import { ChatPushService } from './notify/chat-push.service'
import { PuaiController } from './puai/puai.controller'
import { PuaiRetrieval } from './puai/puai.retrieval'
import { PuaiService } from './puai/puai.service'

// Nhắn tin (Domain 10) + PU AI (Domain 13)
// core · notify (Web Push) ← puai ← conversations ← study-group-chat / messages (không vòng phụ thuộc)
// StudyGroupsModule dùng StudyGroupChatService (chat không phụ thuộc ngược lại)
@Module({
  imports: [RealtimeModule, StorageModule, PushModule, BullModule.registerQueue({ name: CHAT_PUSH_QUEUE })],
  controllers: [ConversationsController, MessagesController, PuaiController],
  providers: [ChatCoreService, ChatPushService, ChatPushProcessor, PuaiRetrieval, PuaiService, ConversationsService, StudyGroupChatService, MessagesService],
  exports: [ConversationsService, StudyGroupChatService]
})
export class ChatModule {}
