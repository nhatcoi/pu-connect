import { Module } from '@nestjs/common'
import { PostsService } from './posts.service'
import { PostsController } from './posts.controller'
import { CommentsService } from './comments.service'
import { CommentsController } from './comments.controller'
import { MentionsModule } from '../mentions/mentions.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { AiModule } from '../ai/ai.module'
import { RealtimeModule } from '../realtime/realtime.module'
import { PostAiService } from './post-ai.service'

@Module({
  imports: [MentionsModule, NotificationsModule, AiModule, RealtimeModule],
  controllers: [PostsController, CommentsController],
  providers: [PostsService, CommentsService, PostAiService],
  exports: [PostsService, CommentsService]
})
export class PostsModule {}

