import { Module } from '@nestjs/common'
import { AiModule } from '../ai/ai.module'
import { StorageModule } from '../storage/storage.module'
import { DocumentsService } from './documents.service'
import { DocumentsController } from './documents.controller'
import { PostDocumentsService } from './post-documents.service'

@Module({
  imports: [AiModule, StorageModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, PostDocumentsService],
  exports: [DocumentsService, PostDocumentsService]
})
export class DocumentsModule {}
