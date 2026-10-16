import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { AiModule } from '../ai/ai.module'
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
import { ChatMentionsService } from './mentions/chat-mentions.service'
import { AiDataService } from './puai/ai-data.service'
import { AiFeedbackService } from './puai/ai-feedback.service'
import { AI_MAINTENANCE_QUEUE, AiMaintenanceProcessor } from './puai/ai-maintenance.processor'
import { AiMemoriesService } from './puai/ai-memories.service'
import { AiAdminController, AiSettingsController } from './puai/ai-settings.controller'
import { AiSettingsService } from './puai/ai-settings.service'
import { AiSummaryService } from './puai/ai-summary.service'
import { AiTasksService } from './puai/ai-tasks.service'
import { AiSkillsController } from './puai/ai-skills.controller'
import { AiSkillsService } from './puai/ai-skills.service'
import { AiThreadsController } from './puai/ai-threads.controller'
import { AiThreadsService } from './puai/ai-threads.service'
import { PuaiController } from './puai/puai.controller'
import { PuaiService } from './puai/puai.service'
import { ChatRefsController } from './refs/chat-refs.controller'
import { ChatRefsService } from './refs/chat-refs.service'

// Nhắn tin (Domain 10) + PU AI (Domain 13)
// AiModule (LLM, quota, truy xuất) ← puai; core · notify (Web Push) ← conversations ← study-group-chat / messages (không vòng phụ thuộc)
// core ← mentions · refs · ai-skills · ai-summary · ai-settings · ai-memories ← puai ← messages ← ai-tasks (worker ai-maintenance)
// StudyGroupsModule dùng StudyGroupChatService (chat không phụ thuộc ngược lại)
@Module({
  imports: [AiModule, RealtimeModule, StorageModule, PushModule, BullModule.registerQueue({ name: CHAT_PUSH_QUEUE }, { name: AI_MAINTENANCE_QUEUE })],
  controllers: [
    ConversationsController,
    MessagesController,
    PuaiController,
    AiThreadsController,
    AiSkillsController,
    ChatRefsController,
    AiSettingsController,
    AiAdminController
  ],
  providers: [
    ChatCoreService,
    ChatPushService,
    ChatPushProcessor,
    ChatMentionsService,
    ChatRefsService,
    AiSkillsService,
    AiSummaryService,
    AiSettingsService,
    AiMemoriesService,
    AiFeedbackService,
    AiDataService,
    AiTasksService,
    AiMaintenanceProcessor,
    AiThreadsService,
    PuaiService,
    ConversationsService,
    StudyGroupChatService,
    MessagesService
  ],
  exports: [ConversationsService, StudyGroupChatService]
})
export class ChatModule {}
