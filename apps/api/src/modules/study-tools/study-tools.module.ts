import { Module } from '@nestjs/common'
import { AiModule } from '../ai/ai.module'
import { StudyAgentToolsService } from './study-agent-tools.service'
import { StudyDraftService } from './study-draft.service'
import { StudyToolsController } from './study-tools.controller'
import { StudyToolsService } from './study-tools.service'

// Công cụ học tập (/tools): bộ Flashcard / Quiz; ChatModule dùng StudyToolsService (tự lưu từ câu trả lời N7AI) + StudyAgentToolsService (tool "Học tập của tôi")
@Module({
  imports: [AiModule],
  controllers: [StudyToolsController],
  providers: [StudyToolsService, StudyDraftService, StudyAgentToolsService],
  exports: [StudyToolsService, StudyAgentToolsService]
})
export class StudyToolsModule {}
