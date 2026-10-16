import { Module } from '@nestjs/common'
import { UsersService } from './users.service'
import { UsersController } from './users.controller'
import { FollowSuggestionsService } from './follow-suggestions.service'
import { ProfileAccessService } from './profile-access.service'
import { PostsModule } from '../posts/posts.module'
import { DatabaseModule } from '../../database/database.module'
import { PersonalizationModule } from '../personalization/personalization.module'

@Module({
  imports: [DatabaseModule, PersonalizationModule, PostsModule],
  controllers: [UsersController],
  providers: [UsersService, FollowSuggestionsService, ProfileAccessService],
  exports: [UsersService, ProfileAccessService]
})
export class UsersModule {}
