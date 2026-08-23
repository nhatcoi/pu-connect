import { Module } from '@nestjs/common'
import { PostsService } from './posts.service'
import { PostsController } from './posts.controller'
import { CommentsService } from './comments.service'
import { CommentsController } from './comments.controller'

@Module({
  controllers: [PostsController, CommentsController],
  providers: [PostsService, CommentsService],
  exports: [PostsService, CommentsService]
})
export class PostsModule {}

