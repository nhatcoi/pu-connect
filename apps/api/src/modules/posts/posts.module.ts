import { Module } from '@nestjs/common'
import { PostsService } from './posts.service'
import { PostsController } from './posts.controller'
import { CommentsService } from './comments.service'
import { CommentsController } from './comments.controller'
import { MentionsModule } from '../mentions/mentions.module'

@Module({
  imports: [MentionsModule],
  controllers: [PostsController, CommentsController],
  providers: [PostsService, CommentsService],
  exports: [PostsService, CommentsService]
})
export class PostsModule {}

