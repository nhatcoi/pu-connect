import { Controller, Get, Post, Body, Param, Query, Req } from '@nestjs/common'
import type { Request } from 'express'
import { requireUserId } from '../../common/http/current-user'

const displayNameOf = (req: Request) => (req.user as { displayName?: string } | undefined)?.displayName || 'Sinh viên Phenikaa'
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
  async create(@Body() data: CreateStudyGroupInput, @Req() req: Request) {
    const userId = requireUserId(req)
    return this.studyGroupsService.create(userId, displayNameOf(req), data)
  }

  @Post(':id/join')
  async join(@Param('id') id: string, @Req() req: Request) {
    // Danh tính lấy từ session, không tin userId trong body
    return this.studyGroupsService.join(id, requireUserId(req), displayNameOf(req))
  }
}
