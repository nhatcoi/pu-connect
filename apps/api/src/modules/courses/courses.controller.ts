import { Controller, Get, Post, Body, Param, Query, Req } from '@nestjs/common'
import type { Request } from 'express'
import { requireRole } from '../../common/http/current-user'
import { CoursesService } from './courses.service'
import type { CreateCourseInput } from '@pu/schemas'

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  async findAll(@Query('department') department?: string) {
    return this.coursesService.findAll(department)
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
