import { Module } from '@nestjs/common'
import { AiRetrieval } from './ai.retrieval'
import { LlmService } from './llm.service'

// Lõi AI dùng chung (Domain 13): chat (PuaiService) và bài viết (PostAiService) cùng một client & quota
@Module({
  providers: [LlmService, AiRetrieval],
  exports: [LlmService, AiRetrieval]
})
export class AiModule {}
