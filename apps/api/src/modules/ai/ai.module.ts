import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { StorageModule } from '../storage/storage.module'
import { AiRetrieval } from './ai.retrieval'
import { AiConnectorsController } from './connectors/ai-connectors.controller'
import { AiConnectorsService } from './connectors/ai-connectors.service'
import { ConnectorCallbackMiddleware } from './connectors/connector-callback'
import { PuConnectorService } from './connectors/pu-connector.service'
import { PuConnectorMcpService } from './connectors/pu-connector-mcp.service'
import { PuConnectorController } from './connectors/pu-connector.controller'
import { GoogleMcpService } from './connectors/google-mcp.service'
import { N7AgentService } from './engine/n7-agent.service'
import { RetrievalToolsService } from './retrieval-tools.service'
import { GoogleOAuthService } from './connectors/google-oauth.service'
import { SemanticScholarService } from './connectors/semantic-scholar.service'
import { WebReaderService } from './connectors/web-reader.service'
import { AiModelCatalogService } from './ai-model-catalog.service'
import { AiProviderRegistry } from './ai-provider.registry'
import { AiServicesConfigService } from './ai-services-config.service'
import { LlmService } from './llm.service'
import { EmbeddingService } from './rag/embedding.service'
import { OcrService } from './rag/ocr.service'
import { RAG_INDEX_QUEUE, RagIndexProcessor, RagIndexQueue } from './rag/rag-index.processor'
import { RagIndexService } from './rag/rag-index.service'
import { RagSearchService } from './rag/rag-search.service'

// Lõi AI dùng chung (Domain 13): chat (N7AiService) và bài viết (PostAiService) cùng một client & quota
// GoogleOAuth → Google MCP clients → model tool loop; internal retrieval stays local
// RAG: embedding (Ollama qua tunnel) + worker index tài liệu/bài viết + tìm kết hợp full-text/vector
@Module({
  imports: [StorageModule, BullModule.registerQueue({ name: RAG_INDEX_QUEUE })],
  controllers: [PuConnectorController, AiConnectorsController],
  providers: [
    AiServicesConfigService,
    LlmService,
    AiProviderRegistry,
    AiModelCatalogService,
    AiRetrieval,
    GoogleOAuthService,
    PuConnectorService,
    PuConnectorMcpService,
    GoogleMcpService,
    N7AgentService,
    RetrievalToolsService,
    SemanticScholarService,
    WebReaderService,
    AiConnectorsService,
    EmbeddingService,
    OcrService,
    RagSearchService,
    RagIndexService,
    RagIndexProcessor,
    RagIndexQueue
  ],
  exports: [
    AiServicesConfigService,
    PuConnectorService,
    LlmService,
    AiProviderRegistry,
    AiModelCatalogService,
    AiRetrieval,
    GoogleOAuthService,
    GoogleMcpService,
    N7AgentService,
    RetrievalToolsService,
    SemanticScholarService,
    WebReaderService,
    RagSearchService,
    RagIndexQueue
  ]
})
export class AiModule implements NestModule {
  // Connector Google đi chung redirect URI đăng nhập: chặn trước guard passport khi state là của connector
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ConnectorCallbackMiddleware).forRoutes({ path: 'auth/google/callback', method: RequestMethod.GET })
  }
}
