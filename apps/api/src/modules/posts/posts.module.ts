import { Module } from '@nestjs/common'
import { PostsService } from './posts.service'
import { PostsController } from './posts.controller'
import { CommentsService } from './comments.service'
import { CommentsController } from './comments.controller'
import { MentionsModule } from '../mentions/mentions.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { AiModule } from '../ai/ai.module'
import { RealtimeModule } from '../realtime/realtime.module'
import { ChatModule } from '../chat/chat.module'
import { ModerationModule } from '../moderation/moderation.module'
import { PostAiService } from './post-ai.service'
import { PostContextService } from './post-context.service'
import { PostThreadToolsService } from './post-thread-tools.service'
import { PostDocumentsService } from '../documents/post-documents.service'

@Module({
  imports: [MentionsModule, NotificationsModule, AiModule, RealtimeModule, ChatModule, ModerationModule],
  controllers: [PostsController, CommentsController],
  providers: [PostsService, CommentsService, PostAiService, PostContextService, PostThreadToolsService, PostDocumentsService],
  exports: [PostsService, CommentsService]
})
export class PostsModule {}
