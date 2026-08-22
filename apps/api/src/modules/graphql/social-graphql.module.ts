import { Module } from '@nestjs/common'
import { FeedResolver } from './resolvers/feed.resolver'
import { UserResolver } from './resolvers/user.resolver'
import { DocumentResolver } from './resolvers/document.resolver'
import { StudyGroupResolver } from './resolvers/study-group.resolver'
import { CommentResolver } from './resolvers/comment.resolver'

@Module({
  providers: [
    FeedResolver,
    UserResolver,
    DocumentResolver,
    StudyGroupResolver,
    CommentResolver
  ],
  exports: [
    FeedResolver,
    UserResolver,
    DocumentResolver,
    StudyGroupResolver,
    CommentResolver
  ]
})
export class SocialGraphQLModule {}
