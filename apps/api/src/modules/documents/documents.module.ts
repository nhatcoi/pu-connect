import { Module } from '@nestjs/common'
import { AiModule } from '../ai/ai.module'
import { StorageModule } from '../storage/storage.module'
import { StudyToolsModule } from '../study-tools/study-tools.module'
import { CollectionsController } from './collections.controller'
import { CollectionsService } from './collections.service'
import { DocumentAiService } from './document-ai.service'
import { DocumentsService } from './documents.service'
import { DocumentsController } from './documents.controller'
import { LibraryController } from './library.controller'
import { LibraryService } from './library.service'
import { PostDocumentsService } from './post-documents.service'

@Module({
  imports: [AiModule, StorageModule, StudyToolsModule],
  controllers: [DocumentsController, LibraryController, CollectionsController],
  providers: [DocumentsService, DocumentAiService, CollectionsService, LibraryService, PostDocumentsService],
  exports: [DocumentsService, PostDocumentsService]
})
export class DocumentsModule {}
