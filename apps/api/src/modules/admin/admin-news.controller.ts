import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import type { NewsArticlePublishInput, NewsConfigInput, NewsSourceInput, NewsStatus } from '@pu/schemas'
import { requireUserId } from '../../common/http/current-user'
import { AdminGuard, RequireAdminPermission } from './admin.guard'
import { AdminNewsService } from './admin-news.service'

@Controller('admin/news')
@UseGuards(AdminGuard)
@RequireAdminPermission('bots:manage')
export class AdminNewsController {
  constructor(private readonly news: AdminNewsService) {}

  @Get()
  overview() {
    return this.news.overview()
  }

  @Post('fetch')
  @HttpCode(HttpStatus.OK)
  fetch(@Req() req: Request) {
    return this.news.fetchNews(requireUserId(req))
  }

  @Post('articles/:id/publish')
  publish(
    @Param('id') id: string,
    @Body() body: NewsArticlePublishInput,
    @Req() req: Request
  ) {
    return this.news.publishArticle(requireUserId(req), id, body)
  }

  @Patch('articles/:id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: NewsStatus,
    @Req() req: Request
  ) {
    return this.news.updateStatus(requireUserId(req), id, status)
  }

  @Post('sources')
  createSource(@Body() body: NewsSourceInput, @Req() req: Request) {
    return this.news.createSource(requireUserId(req), body)
  }

  @Patch('sources/:id')
  updateSource(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<NewsSourceInput>,
    @Req() req: Request
  ) {
    return this.news.updateSource(requireUserId(req), id, body)
  }

  @Delete('sources/:id')
  deleteSource(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.news.deleteSource(requireUserId(req), id)
  }

  @Patch('config')
  updateConfig(@Body() body: NewsConfigInput, @Req() req: Request) {
    return this.news.updateConfig(requireUserId(req), body)
  }
}
