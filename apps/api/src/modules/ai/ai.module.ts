import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common'
import { AiRetrieval } from './ai.retrieval'
import { AiConnectorsController } from './connectors/ai-connectors.controller'
import { AiConnectorsService } from './connectors/ai-connectors.service'
import { ConnectorCallbackMiddleware } from './connectors/connector-callback'
import { GoogleCalendarService } from './connectors/google-calendar.service'
import { GoogleDriveService } from './connectors/google-drive.service'
import { GoogleOAuthService } from './connectors/google-oauth.service'
import { WebReaderService } from './connectors/web-reader.service'
import { LlmService } from './llm.service'

// Lõi AI dùng chung (Domain 13): chat (N7AiService) và bài viết (PostAiService) cùng một client & quota
// Connector: GoogleOAuth ← Drive · Calendar ← AiRetrieval
@Module({
  controllers: [AiConnectorsController],
  providers: [LlmService, AiRetrieval, GoogleOAuthService, GoogleDriveService, GoogleCalendarService, WebReaderService, AiConnectorsService],
  exports: [LlmService, AiRetrieval, GoogleOAuthService]
})
export class AiModule implements NestModule {
  // Connector Google đi chung redirect URI đăng nhập: chặn trước guard passport khi state là của connector
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ConnectorCallbackMiddleware).forRoutes({ path: 'auth/google/callback', method: RequestMethod.GET })
  }
}
