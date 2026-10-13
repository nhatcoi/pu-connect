import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { AiSuggestionsService } from './ai-suggestions.service'
import { InterestProfileService } from './interest-profile.service'
import { PersonalizationController } from './personalization.controller'
import { PersonalizationProcessor } from './personalization.processor'
import { PERSONALIZATION_QUEUE } from './personalization.constants'
import { UserEventsService } from './user-events.service'

// Cá nhân hóa: nhật ký hành vi → hồ sơ quan tâm → gợi ý PU AI & xếp hạng bảng tin
// Feed dùng thẳng bảng user_interests (SQL), không phụ thuộc module này
@Module({
  imports: [BullModule.registerQueue({ name: PERSONALIZATION_QUEUE })],
  controllers: [PersonalizationController],
  providers: [UserEventsService, InterestProfileService, AiSuggestionsService, PersonalizationProcessor],
  exports: [UserEventsService]
})
export class PersonalizationModule {}
