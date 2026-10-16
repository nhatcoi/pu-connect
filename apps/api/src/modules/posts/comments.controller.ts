import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UnauthorizedException
} from '@nestjs/common'
import { CommentsService } from './comments.service'
import { PostAiService } from './post-ai.service'
import { DatabaseService } from '../../database/database.service'
import type { CreateCommentInput } from '@pu/schemas'
import type { Request } from 'express'
import { requireUserId } from '../../common/http/current-user'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { UpdateCommentBodySchema, type UpdateCommentBody } from './dto/comment.dto'

@Controller()
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly postAi: PostAiService,
    private readonly db: DatabaseService
  ) {}

  @Get('posts/:postId/comments')
  async findByPost(
    @Param('postId') postId: string,
    @Query('limit') limit: string | undefined,
    @Query('offset') offset: string | undefined,
    @Req() req: Request
  ) {
    const currentUserId = (req.user as any)?.id || null
    const parsedLimit = limit ? parseInt(limit, 10) : 5
    const parsedOffset = offset ? parseInt(offset, 10) : 0
    const result = await this.commentsService.findByPost(
      postId,
      currentUserId,
      parsedLimit,
      parsedOffset
    )
    return {
      success: true,
      data: result.data,
      total: result.total,
      hasMore: result.hasMore,
      remainingCount: result.remainingCount,
      nextOffset: result.nextOffset
    }
  }

  @Post('posts/:postId/comments')
  async create(
    @Param('postId') postId: string,
    @Body() body: Omit<CreateCommentInput, 'postId'>,
    @Req() req: Request
  ) {
    const authorId = requireUserId(req, 'Vui lòng đăng nhập để bình luận')

    const comment = await this.commentsService.create(authorId, {
      ...body,
      postId
    })
    void this.postAi.onComment(comment, authorId) // @puai ⇒ PU AI trả lời nền

    return {
      success: true,
      data: comment
    }
  }

  @Post('comments/:id/like')
  async toggleLike(@Param('id') id: string, @Req() req: Request) {
    const userId = requireUserId(req, 'Vui lòng đăng nhập')

    return this.commentsService.toggleLike(id, userId)
  }

  @Post('comments/:id/accept-solution')
  async acceptSolution(@Param('id') id: string, @Req() req: Request) {
    const userId = requireUserId(req, 'Vui lòng đăng nhập')

    return this.commentsService.acceptSolution(id, userId)
  }

  // Sửa bình luận (chỉ tác giả); chỉ báo người MỚI được @mention
  @Patch('comments/:id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCommentBodySchema)) body: UpdateCommentBody,
    @Req() req: Request
  ) {
    const userId = requireUserId(req, 'Vui lòng đăng nhập')
    return { success: true, data: await this.commentsService.update(id, userId, body.content) }
  }

  @Delete('comments/:id')
  async deleteComment(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any
    if (!user) {
      throw new UnauthorizedException('Vui lòng đăng nhập')
    }

    const success = await this.commentsService.delete(id, user.id, user.role === 'admin')
    return { success }
  }
}
