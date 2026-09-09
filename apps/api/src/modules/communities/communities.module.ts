import { Module } from '@nestjs/common'
import { CommunitiesController } from './communities.controller'
import { CommunitiesService } from './communities.service'
import { DatabaseModule } from '../../database/database.module'

@Module({
  imports: [DatabaseModule],
  controllers: [CommunitiesController],
  providers: [CommunitiesService],
  exports: [CommunitiesService]
})
export class CommunitiesModule {}
