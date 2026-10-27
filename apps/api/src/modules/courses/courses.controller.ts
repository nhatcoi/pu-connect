import { Controller, Delete, Get, Post, Put, Body, Param, ParseUUIDPipe, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { requireRole, requireUserId } from '../../common/http/current-user'
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard'
import { CoursesService } from './courses.service'
import type { CreateCourseInput } from '@pu/schemas'

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  async findAll(@Query('department') department?: string) {
    return this.coursesService.findAll(department)
  }

  // Phải đứng trước ':id'
  @Get('followed')
  @UseGuards(AuthenticatedGuard)
  async followed(@Req() req: Request) {
    return this.coursesService.followedIds(requireUserId(req))
  }

  @Put(':id/follow')
  @UseGuards(AuthenticatedGuard)
  async follow(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.coursesService.setFollow(requireUserId(req), id, true)
  }

  @Delete(':id/follow')
  @UseGuards(AuthenticatedGuard)
  async unfollow(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.coursesService.setFollow(requireUserId(req), id, false)
  }

  @Get(':id/overview')
  async overview(@Param('id') id: string) {
    return this.coursesService.getOverview(id)
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.coursesService.findOne(id)
  }

  @Post()
  async create(@Body() data: CreateCourseInput, @Req() req: Request) {
    requireRole(req, ['admin', 'lecturer'])
    return this.coursesService.create(data)
  }
}
