import { Module } from '@nestjs/common'
import { AiModule } from '../ai/ai.module'
import { StudyAgentToolsService } from './study-agent-tools.service'
import { StudyCreateToolsService } from './study-create-tools.service'
import { StudyDraftService } from './study-draft.service'
import { StudyProgressMemoryService } from './study-progress-memory.service'
import { StudyToolsController } from './study-tools.controller'
import { StudyToolsService } from './study-tools.service'

// Công cụ học tập (/tools): bộ Flashcard / Quiz; ChatModule dùng StudyToolsService (tự lưu từ câu trả lời N7AI) + StudyAgentToolsService (tool đọc "Học tập của tôi") + StudyCreateToolsService (tool tạo bộ)
@Module({
  imports: [AiModule],
  controllers: [StudyToolsController],
  providers: [StudyToolsService, StudyDraftService, StudyAgentToolsService, StudyCreateToolsService, StudyProgressMemoryService],
  exports: [StudyToolsService, StudyAgentToolsService, StudyCreateToolsService]
})
export class StudyToolsModule {}
