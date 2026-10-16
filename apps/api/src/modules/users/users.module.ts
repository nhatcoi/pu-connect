import { Module } from '@nestjs/common'
import { UsersService } from './users.service'
import { UsersController } from './users.controller'
import { FollowSuggestionsService } from './follow-suggestions.service'
import { DatabaseModule } from '../../database/database.module'
import { PersonalizationModule } from '../personalization/personalization.module'

@Module({
  imports: [DatabaseModule, PersonalizationModule],
  controllers: [UsersController],
  providers: [UsersService, FollowSuggestionsService],
  exports: [UsersService]
})
export class UsersModule {}
