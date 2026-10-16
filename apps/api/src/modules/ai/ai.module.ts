import { Module } from '@nestjs/common'
import { AiRetrieval } from './ai.retrieval'
import { AiConnectorsController } from './connectors/ai-connectors.controller'
import { AiConnectorsService } from './connectors/ai-connectors.service'
import { GoogleDriveService } from './connectors/google-drive.service'
import { LlmService } from './llm.service'

// Lõi AI dùng chung (Domain 13): chat (PuaiService) và bài viết (PostAiService) cùng một client & quota
// Connector (nội bộ + Google Drive) ← AiRetrieval
@Module({
  controllers: [AiConnectorsController],
  providers: [LlmService, AiRetrieval, GoogleDriveService, AiConnectorsService],
  exports: [LlmService, AiRetrieval]
})
export class AiModule {}
