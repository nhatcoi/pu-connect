import { Module } from '@nestjs/common'
import { CoursesController } from './courses.controller'
import { CourseSuggestionsService } from './course-suggestions.service'
import { CoursesService } from './courses.service'

@Module({
  controllers: [CoursesController],
  providers: [CoursesService, CourseSuggestionsService],
  exports: [CoursesService]
})
export class CoursesModule {}
