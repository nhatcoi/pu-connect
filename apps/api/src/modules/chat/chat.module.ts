import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { AiModule } from '../ai/ai.module'
import { StudyToolsModule } from '../study-tools/study-tools.module'
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
import { AiDataService } from './n7ai/ai-data.service'
import { AiFeedbackService } from './n7ai/ai-feedback.service'
import { AI_MAINTENANCE_QUEUE, AiMaintenanceProcessor } from './n7ai/ai-maintenance.processor'
import { AiLibraryController } from './n7ai/ai-library.controller'
import { AiLibraryService } from './n7ai/ai-library.service'
import { AiMemoriesService } from './n7ai/ai-memories.service'
import { AiAdminController, AiSettingsController } from './n7ai/ai-settings.controller'
import { AiSettingsService } from './n7ai/ai-settings.service'
import { AiSummaryService } from './n7ai/ai-summary.service'
import { AiTasksService } from './n7ai/ai-tasks.service'
import { AiSkillsController } from './n7ai/ai-skills.controller'
import { AiSkillsService } from './n7ai/ai-skills.service'
import { AiSkillDraftService } from './n7ai/ai-skill-draft.service'
import { AiSharedController } from './n7ai/ai-shared.controller'
import { AiThreadShareService } from './n7ai/ai-thread-share.service'
import { AiThreadsController } from './n7ai/ai-threads.controller'
import { AiThreadsService } from './n7ai/ai-threads.service'
import { N7AiController } from './n7ai/n7ai.controller'
import { N7AiService } from './n7ai/n7ai.service'
import { ChatRefsController } from './refs/chat-refs.controller'
import { ChatRefsService } from './refs/chat-refs.service'

// Nhắn tin (Domain 10) + N7AI (Domain 13)
// AiModule (LLM, quota, truy xuất) ← n7ai; core · notify (Web Push) ← conversations ← study-group-chat / messages (không vòng phụ thuộc)
// core ← mentions · refs · ai-skills · ai-summary · ai-settings · ai-memories ← n7ai ← messages ← ai-tasks (worker ai-maintenance)
// StudyGroupsModule dùng StudyGroupChatService (chat không phụ thuộc ngược lại)
@Module({
  imports: [AiModule, StudyToolsModule, RealtimeModule, StorageModule, PushModule, BullModule.registerQueue({ name: CHAT_PUSH_QUEUE }, { name: AI_MAINTENANCE_QUEUE })],
  controllers: [
    ConversationsController,
    MessagesController,
    N7AiController,
    AiThreadsController,
    AiSharedController,
    AiLibraryController,
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
    AiSkillDraftService,
    AiSummaryService,
    AiSettingsService,
    AiMemoriesService,
    AiFeedbackService,
    AiDataService,
    AiTasksService,
    AiMaintenanceProcessor,
    AiThreadsService,
    AiThreadShareService,
    AiLibraryService,
    N7AiService,
    ConversationsService,
    StudyGroupChatService,
    MessagesService
  ],
  exports: [ConversationsService, StudyGroupChatService]
})
export class ChatModule {}
