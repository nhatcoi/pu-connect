import { Module } from '@nestjs/common'
import { FeedResolver } from './resolvers/feed.resolver'
import { UserResolver } from './resolvers/user.resolver'
import { DocumentResolver } from './resolvers/document.resolver'
import { StudyGroupResolver } from './resolvers/study-group.resolver'

@Module({
  providers: [FeedResolver, UserResolver, DocumentResolver, StudyGroupResolver],
  exports: [FeedResolver, UserResolver, DocumentResolver, StudyGroupResolver]
})
export class SocialGraphQLModule {}
