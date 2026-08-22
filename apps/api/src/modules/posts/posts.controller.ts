import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common'
import { PostsService } from './posts.service'
import type { CreatePostInput } from '@pu/schemas'

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  async findAll(@Query('tag') tag?: string) {
    return this.postsService.findAll(tag)
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.postsService.findOne(id)
  }

  @Post()
  async create(@Body() body: CreatePostInput) {
    return this.postsService.create('user_me', body)
  }

  @Post(':id/like')
  async toggleLike(@Param('id') id: string) {
    return this.postsService.toggleLike(id)
  }
}
