import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import type { Readable } from 'stream'
import type { DocCategory, DocumentSummary, DocumentSuggestion, StudySetDraft, StudyToolKind, WriteDocumentPostInput, WriteDocumentPostResult } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import type { AiRef } from '../ai/ai.constants'
import { DOC_CLASSIFY_PROMPT, DOC_POST_PROMPT, DOC_SUMMARY_PROMPT, SYSTEM_PROMPT } from '../ai/ai.prompts'
import { bufferToText, isExtractableMime } from '../ai/doc-text'
import { LlmService, type LlmMessage } from '../ai/llm.service'
import { StorageService } from '../storage/storage.service'
import { StudyDraftService } from '../study-tools/study-draft.service'
import { DOC_CATEGORIES, DOC_CATEGORY_LABELS, MAX_POST_DOCUMENTS } from './dto/documents.dto'

const SUGGEST_INPUT_CHARS = 6000
const POST_INPUT_CHARS = 2500 // mỗi tài liệu khi viết bài
const STUDY_INPUT_CHARS = 8000 // nội dung đưa vào tóm tắt / tạo flashcard, quiz
const LIVE_READ_MAX_BYTES = 20 * 1024 * 1024
const LIVE_READ_PAGES = 5
const AI_MAX_TOKENS = 2048 // gồm token suy nghĩ của model

type DocRow = { id: string; title: string; original_name: string | null; file_url: string; mime_type: string; owner_id: string }

// N7AI cho kho tài liệu: gợi ý phân loại từ nội dung tệp, viết bài giới thiệu tài liệu
// Cả hai tính 1 lượt N7AI; người dùng xem kết quả rồi tự lưu (AI không tự đổi dữ liệu)
@Injectable()
export class DocumentAiService {
  constructor(
    private readonly db: DatabaseService,
    private readonly llm: LlmService,
    private readonly storage: StorageService,
    private readonly studyDrafts: StudyDraftService
  ) {}

  async suggest(id: string, userId: string): Promise<DocumentSuggestion> {
    const res = await this.db.query(`SELECT id, title, original_name, file_url, mime_type, owner_id FROM documents WHERE id = $1`, [id])
    const doc = res.rows[0] as DocRow | undefined
    if (!doc) throw new NotFoundException('Tài liệu không tồn tại')
    if (doc.owner_id !== userId) throw new ForbiddenException('Chỉ người đăng được phân loại tài liệu')

    const courses = (await this.db.query(`SELECT id, code, name FROM courses ORDER BY code LIMIT 400`)).rows as { id: string; code: string; name: string }[]
    const excerpt = await this.excerpt(doc, SUGGEST_INPUT_CHARS)
    const user = [
      `<courses>\n${courses.map((c) => `${c.code} | ${c.name}`).join('\n')}\n</courses>`,
      `<categories>\n${DOC_CATEGORIES.map((k) => `${k} | ${DOC_CATEGORY_LABELS[k]}`).join('\n')}\n</categories>`,
      `<document>\nTên tệp: ${doc.original_name || doc.title}\n${excerpt ? `Nội dung (đoạn đầu):\n${excerpt}` : '(Không đọc được nội dung, chỉ dựa vào tên tệp)'}\n</document>`
    ].join('\n\n')

    const text = await this.run(userId, 'doc_classify', { type: 'document', id }, [
      { role: 'system', content: SYSTEM_PROMPT + DOC_CLASSIFY_PROMPT },
      { role: 'user', content: user }
    ])
    return parseSuggestion(text, courses)
  }

  // Tài liệu dùng được: của chính mình (kể cả nháp) hoặc công khai đã đăng
  async writePost(userId: string, input: WriteDocumentPostInput): Promise<WriteDocumentPostResult> {
    const ids = [...new Set(input.documentIds)].slice(0, MAX_POST_DOCUMENTS)
    const res = await this.db.query(
      `SELECT d.id, d.title, d.original_name, d.file_url, d.mime_type, d.owner_id, d.doc_type, d.academic_year, c.code AS course_code, c.name AS course_name
       FROM documents d LEFT JOIN courses c ON c.id = d.course_id
       WHERE d.id = ANY($1::uuid[]) AND (d.owner_id = $2 OR (d.visibility = 'public' AND d.status = 'published'))`,
      [ids, userId]
    )
    if (!res.rows.length) throw new BadRequestException('Chưa có tài liệu để viết bài')

    const blocks: string[] = []
    for (const d of res.rows) {
      const meta = [
        `Tiêu đề: ${d.title}`,
        d.course_code && `Môn: ${d.course_code} — ${d.course_name}`,
        d.doc_type && `Loại: ${DOC_CATEGORY_LABELS[d.doc_type as DocCategory] ?? d.doc_type}`,
        d.academic_year && `Năm học: ${d.academic_year}`
      ].filter(Boolean)
      const excerpt = await this.excerpt(d, POST_INPUT_CHARS)
      blocks.push(`<doc>\n${meta.join('\n')}${excerpt ? `\nNội dung (đoạn đầu):\n${excerpt}` : ''}\n</doc>`)
    }
    const draft = input.content?.trim()
    const user = `<documents>\n${blocks.join('\n')}\n</documents>${draft ? `\n\n<draft>\n${draft.slice(0, 2000)}\n</draft>` : ''}\n\nViết nội dung bài đăng.`

    const content = await this.run(userId, 'doc_post', { type: 'document', id: res.rows[0].id }, [
      { role: 'system', content: SYSTEM_PROMPT + DOC_POST_PROMPT },
      { role: 'user', content: user }
    ])
    return { content: content.trim() }
  }

  // "Học với N7AI": tóm tắt tài liệu (người xem được tài liệu đều dùng được, 1 lượt N7AI mỗi lần)
  async summarize(id: string, userId: string): Promise<DocumentSummary> {
    const { doc, context } = await this.studyContext(id, userId)
    const text = await this.run(userId, 'doc_summary', { type: 'document', id }, [
      { role: 'system', content: SYSTEM_PROMPT + DOC_SUMMARY_PROMPT },
      { role: 'user', content: `<document>\n${context}\n</document>` }
    ])
    return { documentId: doc.id, summary: text.trim() }
  }

  // Bản nháp bộ Flashcard / Quiz từ nội dung tài liệu (chưa lưu; StudyDraftService tự kiểm quota + ghi ai_runs)
  async studyDraft(id: string, userId: string, kind: StudyToolKind): Promise<StudySetDraft> {
    const { doc, context } = await this.studyContext(id, userId)
    const draft = await this.studyDrafts.draft(userId, kind, `Tạo bộ ôn tập từ tài liệu "${doc.title}" dưới đây, chỉ dựa trên nội dung được cung cấp.\n\n${context}`)
    return { ...draft, title: draft.title || doc.title }
  }

  // Tài liệu xem được (của mình hoặc công khai đã đăng) + nội dung đã trích; không trích được thì từ chối thay vì để AI bịa từ tên tệp
  private async studyContext(id: string, userId: string): Promise<{ doc: DocRow; context: string }> {
    const res = await this.db.query(
      `SELECT d.id, d.title, d.original_name, d.file_url, d.mime_type, d.owner_id, c.code AS course_code, c.name AS course_name
       FROM documents d LEFT JOIN courses c ON c.id = d.course_id
       WHERE d.id = $1 AND (d.owner_id = $2 OR (d.visibility = 'public' AND d.status = 'published'))`,
      [id, userId]
    )
    const row = res.rows[0] as (DocRow & { course_code: string | null; course_name: string | null }) | undefined
    if (!row) throw new NotFoundException('Tài liệu không tồn tại hoặc bạn không có quyền xem')
    const excerpt = await this.excerpt(row, STUDY_INPUT_CHARS)
    if (!excerpt) throw new BadRequestException('N7AI chưa đọc được nội dung tài liệu này (tệp quét ảnh hoặc định dạng chưa hỗ trợ)')
    const head = [`Tên: ${row.title}`, row.course_code && `Môn: ${row.course_code} — ${row.course_name}`].filter(Boolean).join('\n')
    return { doc: row, context: `${head}\nNội dung (đoạn đầu):\n${excerpt}` }
  }

  // Kiểm quota + ghi ai_runs quanh 1 lần gọi model
  private async run(userId: string, task: string, source: AiRef, messages: LlmMessage[]): Promise<string> {
    if (!this.llm.client) throw new ServiceUnavailableException('N7AI chưa sẵn sàng, bạn thử lại sau nhé')
    if (!(await this.llm.hasQuota(userId))) {
      await this.llm.logRejected(userId, 'document')
      throw new HttpException('Bạn đã dùng hết lượt N7AI hôm nay', HttpStatus.TOO_MANY_REQUESTS)
    }
    const started = Date.now()
    const runId = await this.llm.startRun({ requesterId: userId, trigger: 'document', task, source })
    try {
      const { text, usage } = await this.llm.complete(messages, AI_MAX_TOKENS)
      if (!text) throw new Error('empty response')
      await this.llm.finishRun(runId, { usage, startedAt: started })
      return text
    } catch (err) {
      await this.llm.failRun(runId, err, started)
      throw new ServiceUnavailableException(this.llm.isBusyError(err) ? 'N7AI đang quá tải, bạn thử lại sau ít phút nhé' : 'N7AI chưa xử lý được tài liệu này')
    }
  }

  // Đoạn đầu nội dung: lấy từ document_chunks (đã index); chưa index xong ⇒ đọc thẳng vài trang đầu trên R2
  private async excerpt(doc: Pick<DocRow, 'id' | 'file_url' | 'mime_type'>, maxChars: number): Promise<string> {
    const chunks = await this.db.query(`SELECT content_text FROM document_chunks WHERE document_id = $1 ORDER BY chunk_index LIMIT 12`, [doc.id])
    let text = chunks.rows.map((r) => r.content_text as string).join('\n')
    const prefix = this.storage.publicUrlFor('documents/')
    // Chỉ đọc tệp trên R2 của hệ thống (chặn SSRF)
    if (!text && isExtractableMime(doc.mime_type) && doc.file_url.startsWith(prefix)) {
      try {
        const object = await this.storage.readObject(`documents/${doc.file_url.slice(prefix.length)}`)
        if (object && (object.size ?? 0) <= LIVE_READ_MAX_BYTES) text = await bufferToText(await readAll(object.body, LIVE_READ_MAX_BYTES), doc.mime_type, LIVE_READ_PAGES)
      } catch {
        text = '' // không đọc được ⇒ AI dựa vào tên tệp
      }
    }
    return text.slice(0, maxChars).trim()
  }
}

async function readAll(stream: Readable, limit: number): Promise<Buffer> {
  const parts: Buffer[] = []
  let size = 0
  for await (const chunk of stream) {
    size += chunk.length
    if (size > limit) throw new Error('Tệp quá lớn')
    parts.push(Buffer.from(chunk))
  }
  return Buffer.concat(parts)
}

// Model trả JSON (có thể kèm ```); chỉ giữ giá trị hợp lệ: mã môn có thật, khóa loại đúng, năm học liền nhau
export function parseSuggestion(text: string, courses: { id: string; code: string }[]): DocumentSuggestion {
  const empty: DocumentSuggestion = { title: null, courseId: null, courseCode: null, docCategory: null, academicYear: null }
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return empty
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(match[0])
  } catch {
    return empty
  }
  const code = typeof raw.courseCode === 'string' ? raw.courseCode.trim().toUpperCase() : ''
  const course = courses.find((c) => c.code.toUpperCase() === code)
  const category = DOC_CATEGORIES.find((k) => k === raw.docCategory) ?? null
  const year = typeof raw.academicYear === 'string' ? raw.academicYear.trim() : ''
  const yearMatch = year.match(/^(\d{4})-(\d{4})$/)
  const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 200) : ''
  return {
    title: title || null,
    courseId: course?.id ?? null,
    courseCode: course?.code ?? null,
    docCategory: category,
    academicYear: yearMatch && Number(yearMatch[2]) === Number(yearMatch[1]) + 1 ? year : null
  }
}
