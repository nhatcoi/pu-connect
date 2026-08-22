import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common'
import { StudyGroupsService } from './study-groups.service'
import type { CreateStudyGroupInput } from '@pu/schemas'

@Controller('study-groups')
export class StudyGroupsController {
  constructor(private readonly studyGroupsService: StudyGroupsService) {}

  @Get()
  async findAll(@Query('course') course?: string) {
    return this.studyGroupsService.findAll(course)
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.studyGroupsService.findOne(id)
  }

  @Post()
  async create(@Body() data: CreateStudyGroupInput) {
    return this.studyGroupsService.create('user_1', 'Sinh viên Phenikaa', data)
  }

  @Post(':id/join')
  async join(@Param('id') id: string, @Body() body: { userId?: string; displayName?: string }) {
    return this.studyGroupsService.join(
      id,
      body.userId || 'user_1',
      body.displayName || 'Sinh viên Phenikaa'
    )
  }
}
