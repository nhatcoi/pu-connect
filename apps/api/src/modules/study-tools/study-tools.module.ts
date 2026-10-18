import { Module } from '@nestjs/common'
import { AiModule } from '../ai/ai.module'
import { StudyDraftService } from './study-draft.service'
import { StudyToolsController } from './study-tools.controller'
import { StudyToolsService } from './study-tools.service'

// Công cụ học tập (/tools): bộ Flashcard / Quiz; ChatModule dùng StudyToolsService để tự lưu từ câu trả lời N7AI
@Module({
  imports: [AiModule],
  controllers: [StudyToolsController],
  providers: [StudyToolsService, StudyDraftService],
  exports: [StudyToolsService]
})
export class StudyToolsModule {}
