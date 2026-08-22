import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common'
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
  async create(@Body() data: CreateCourseInput) {
    return this.coursesService.create(data)
  }
}
