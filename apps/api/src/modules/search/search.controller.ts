import { Controller, Get, Query, Req, BadRequestException } from '@nestjs/common'
import type { Request } from 'express'
import { SearchService } from './search.service'
import type { SearchResult, SearchType } from '@pu/schemas'

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(
    @Query('q') q: string,
    @Query('type') type: SearchType = 'all',
    @Query('field') field?: string,
    @Query('limit') limit = '20',
    @Query('offset') offset = '0',
    @Req() req?: Request
  ): Promise<SearchResult> {
    if (!q || !q.trim()) {
      throw new BadRequestException('Từ khóa tìm kiếm (q) không được để trống')
    }

    const currentUserId = (req as any)?.user?.id as string | undefined
    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20))
    const parsedOffset = Math.max(0, parseInt(offset, 10) || 0)

    return this.searchService.search(
      {
        q: q.trim(),
        type,
        // id lĩnh vực quan tâm; giá trị không phải uuid (vd 'ALL') ⇒ không lọc
        field: field && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(field) ? field : undefined,
        limit: parsedLimit,
        offset: parsedOffset
      },
      currentUserId
    )
  }
}
