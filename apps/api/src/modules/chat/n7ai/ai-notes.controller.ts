import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common'
import type { Request, Response } from 'express'
import type { AiNoteAppendInput, AiNoteCreateInput, AiNoteUpdateInput } from '@pu/schemas'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { requireUserId } from '../../../common/http/current-user'
import { AuthenticatedGuard } from '../../auth/guards/authenticated.guard'
import { AiNoteAppendSchema, AiNoteCreateSchema, AiNoteUpdateSchema } from '../dto/chat.dto'
import { noteFileName, noteToDocx } from './ai-notes-export'
import { AiNotesService } from './ai-notes.service'

// Ghi chú Markdown N7AI: danh sách · chi tiết · tạo · sửa (tự lưu) · thêm đoạn · xóa · xuất md / docx
@Controller('ai/notes')
@UseGuards(AuthenticatedGuard)
export class AiNotesController {
  constructor(private readonly notes: AiNotesService) {}

  @Get()
  list(@Req() req: Request) {
    return this.notes.list(requireUserId(req))
  }

  @Post()
  create(@Body(new ZodValidationPipe(AiNoteCreateSchema)) body: AiNoteCreateInput, @Req() req: Request) {
    return this.notes.create(requireUserId(req), body)
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.notes.get(requireUserId(req), id)
  }

  @Get(':id/export')
  async export(@Param('id', ParseUUIDPipe) id: string, @Query('format') format: string, @Req() req: Request, @Res() res: Response) {
    const note = await this.notes.get(requireUserId(req), id)
    const docx = format === 'docx'
    const name = encodeURIComponent(noteFileName(note.title, docx ? 'docx' : 'md'))
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${name}`)
    if (docx) {
      res.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document').send(await noteToDocx(note.title, note.content))
    } else {
      res.type('text/markdown; charset=utf-8').send(`# ${note.title || 'Ghi chú'}\n\n${note.content}\n`)
    }
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(AiNoteUpdateSchema)) body: AiNoteUpdateInput, @Req() req: Request) {
    return this.notes.update(requireUserId(req), id, body)
  }

  @Post(':id/append')
  append(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(AiNoteAppendSchema)) body: AiNoteAppendInput, @Req() req: Request) {
    return this.notes.append(requireUserId(req), id, body.markdown)
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.notes.remove(requireUserId(req), id)
  }
}
