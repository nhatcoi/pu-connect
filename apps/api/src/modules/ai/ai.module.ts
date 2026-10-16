import { Module } from '@nestjs/common'
import { AiRetrieval } from './ai.retrieval'
import { AiConnectorsController } from './connectors/ai-connectors.controller'
import { AiConnectorsService } from './connectors/ai-connectors.service'
import { GoogleCalendarService } from './connectors/google-calendar.service'
import { GoogleDriveService } from './connectors/google-drive.service'
import { GoogleOAuthService } from './connectors/google-oauth.service'
import { LlmService } from './llm.service'

// Lõi AI dùng chung (Domain 13): chat (PuaiService) và bài viết (PostAiService) cùng một client & quota
// Connector: GoogleOAuth ← Drive · Calendar ← AiRetrieval
@Module({
  controllers: [AiConnectorsController],
  providers: [LlmService, AiRetrieval, GoogleOAuthService, GoogleDriveService, GoogleCalendarService, AiConnectorsService],
  exports: [LlmService, AiRetrieval]
})
export class AiModule {}
