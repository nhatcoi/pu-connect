import { Module } from '@nestjs/common'
import { MentionsService } from './mentions.service'
import { MentionSuggestService } from './mention-suggest.service'
import { MentionsController } from './mentions.controller'

@Module({
  controllers: [MentionsController],
  providers: [MentionsService, MentionSuggestService],
  exports: [MentionsService]
})
export class MentionsModule {}
