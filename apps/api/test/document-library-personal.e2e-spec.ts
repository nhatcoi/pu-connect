import * as request from 'supertest'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { CommentItem, DocumentDetail, DocumentListPage, DocumentSuggestion, DocumentUploadResult, LibraryFolder, LibraryPage, PostItem } from '@pu/schemas'
import type { DatabaseService } from '../src/database/database.service'
import { LlmService } from '../src/modules/ai/llm.service'
import { StorageService } from '../src/modules/storage/storage.service'
import { createTestApp, createUser, loginAgent } from './helpers'

// Kho tài liệu đợt 2–4: N7AI gợi ý / viết giúp, kho cá nhân, tài liệu trong bình luận, trang Tài liệu & chi tiết
describe('Document library — AI, personal library, pages (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService
  let llm: LlmService
  let courseId: string
  let courseCode: string
  let seq = 0

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
    const storage = app.get(StorageService)
    jest.spyOn(storage, 'uploadFile').mockImplementation(async (buf: Buffer, name: string) => {
      const key = `documents/test/${Date.now()}_${String(++seq).padStart(6, '0')}_${name}`
      return { url: storage.publicUrlFor(key), key, size: buf.length }
    })
    jest.spyOn(storage, 'readObject').mockResolvedValue(null)
    jest.spyOn(storage, 'deleteObjects').mockResolvedValue()
    llm = app.get(LlmService)
    jest.spyOn(llm, 'client', 'get').mockReturnValue({} as never)
    courseCode = `LIB${Math.floor(Math.random() * 1e6)}`
    courseId = (await db.query(`INSERT INTO courses (code, name, credits) VALUES ($1, 'Môn kho', 3) RETURNING id`, [courseCode])).rows[0].id
  })
  afterAll(async () => {
    await app.close()
  })

  type Agent = Awaited<ReturnType<typeof loginAgent>>
  const upload = async (agent: Agent, body: string, name = 'tai_lieu.pdf', path = '/api/documents/upload') =>
    (await agent.post(path).attach('file', Buffer.from(body), { filename: name, contentType: 'application/pdf' }).expect(201)).body.data
  const publishListed = async (agent: Agent, body: string) => {
    const { document } = (await upload(agent, body)) as DocumentUploadResult
    await agent.patch(`/api/documents/${document.id}`).send({ courseId, docCategory: 'final_exam', listed: true }).expect(200)
    await agent.post('/api/posts').send({ content: `Chia sẻ ${body}`, documentIds: [document.id] }).expect(201)
    return document.id as string
  }

  it('N7AI gợi ý: chỉ giữ mã môn có thật / khóa loại đúng; chỉ chủ tài liệu gọi được', async () => {
    const owner = await createUser(db)
    const other = await createUser(db)
    const ownerAgent = await loginAgent(app, owner)
    const { document } = (await upload(ownerAgent, 'de thi cuoi ky')) as DocumentUploadResult

    jest.spyOn(llm, 'complete').mockResolvedValueOnce({
      text: '```json\n{"courseCode": "' + courseCode.toLowerCase() + '", "docCategory": "final_exam", "academicYear": "2024-2025", "title": "Đề cuối kỳ 2024"}\n```',
      finishReason: 'stop'
    })
    const s = (await ownerAgent.post(`/api/documents/${document.id}/suggest`).expect(200)).body.data as DocumentSuggestion
    expect(s).toEqual({ title: 'Đề cuối kỳ 2024', courseId, courseCode, docCategory: 'final_exam', academicYear: '2024-2025' })

    jest.spyOn(llm, 'complete').mockResolvedValueOnce({ text: '{"courseCode": "KHONGCO", "docCategory": "bịa", "academicYear": "2024-2030", "title": ""}', finishReason: 'stop' })
    const bad = (await ownerAgent.post(`/api/documents/${document.id}/suggest`).expect(200)).body.data as DocumentSuggestion
    expect(bad).toEqual({ title: null, courseId: null, courseCode: null, docCategory: null, academicYear: null })

    await (await loginAgent(app, other)).post(`/api/documents/${document.id}/suggest`).expect(403)
    const runs = await db.query(`SELECT count(*)::int AS n FROM ai_runs WHERE requester_id = $1 AND trigger = 'document' AND status = 'done'`, [owner.id])
    expect(runs.rows[0].n).toBe(2)
  })

  it('Viết giúp: dùng tài liệu của mình, không đọc được nháp của người khác', async () => {
    const owner = await createUser(db)
    const other = await createUser(db)
    const ownerAgent = await loginAgent(app, owner)
    const { document } = (await upload(ownerAgent, 'slide chuong 2')) as DocumentUploadResult
    const spy = jest.spyOn(llm, 'complete').mockResolvedValueOnce({ text: 'Mình chia sẻ slide chương 2 #OnThi', finishReason: 'stop' })
    const res = (await ownerAgent.post('/api/documents/write-post').send({ documentIds: [document.id], content: 'slide nè' }).expect(200)).body.data
    expect(res.content).toBe('Mình chia sẻ slide chương 2 #OnThi')
    expect(JSON.stringify(spy.mock.calls.at(-1)?.[0])).toContain('slide nè')

    await (await loginAgent(app, other)).post('/api/documents/write-post').send({ documentIds: [document.id] }).expect(400)
  })

  it('Học với N7AI: tóm tắt + nháp flashcard từ nội dung tài liệu; không đọc được nội dung ⇒ 400; nháp người khác ⇒ 404', async () => {
    const owner = await createUser(db)
    const other = await createUser(db)
    const ownerAgent = await loginAgent(app, owner)
    const otherAgent = await loginAgent(app, other)
    const { document } = (await upload(ownerAgent, 'giai tich chuong 1')) as DocumentUploadResult

    // Chưa có nội dung đã trích (tệp giả không đọc được) ⇒ từ chối, không gọi model
    const spy = jest.spyOn(llm, 'complete')
    const calls = spy.mock.calls.length
    await ownerAgent.post(`/api/documents/${document.id}/summarize`).expect(400)
    expect(spy.mock.calls.length).toBe(calls)

    await db.query(`INSERT INTO document_chunks (document_id, chunk_index, content_text) VALUES ($1, 0, 'Giới hạn của dãy số: định nghĩa epsilon-N.')`, [document.id])
    spy.mockResolvedValueOnce({ text: '- Giới hạn dãy số\n\nNên ôn: định nghĩa epsilon-N', finishReason: 'stop' })
    const sum = (await ownerAgent.post(`/api/documents/${document.id}/summarize`).expect(200)).body.data
    expect(sum).toEqual({ documentId: document.id, summary: '- Giới hạn dãy số\n\nNên ôn: định nghĩa epsilon-N' })
    expect(JSON.stringify(spy.mock.calls.at(-1)?.[0])).toContain('epsilon-N')

    spy.mockResolvedValueOnce({
      text: JSON.stringify({ title: 'Giới hạn dãy số', cards: [{ front: 'Định nghĩa giới hạn dãy số?', back: 'Với mọi epsilon tồn tại N…' }] }),
      finishReason: 'stop'
    })
    const draft = (await ownerAgent.post(`/api/documents/${document.id}/study-draft`).send({ kind: 'flashcards' }).expect(200)).body.data
    expect(draft).toMatchObject({ kind: 'flashcards', title: 'Giới hạn dãy số' })
    expect(draft.items).toHaveLength(1)
    await ownerAgent.post(`/api/documents/${document.id}/study-draft`).send({ kind: 'khac' }).expect(400)

    // Tài liệu nháp của chủ ⇒ người khác không thấy
    await otherAgent.post(`/api/documents/${document.id}/summarize`).expect(404)
  })

  it('kho cá nhân: lưu tài liệu công khai, thư mục, bỏ lưu; tài liệu bị chuyển riêng tư biến mất', async () => {
    const author = await createUser(db)
    const reader = await createUser(db)
    const authorAgent = await loginAgent(app, author)
    const readerAgent = await loginAgent(app, reader)
    const docId = await publishListed(authorAgent, 'de thi luu kho')

    const folder = (await readerAgent.post('/api/library/folders').send({ name: 'Ôn thi' }).expect(201)).body.data as LibraryFolder
    await readerAgent.post('/api/library/folders').send({ name: 'ôn thi' }).expect(409)
    await readerAgent.post('/api/library').send({ documentId: docId, folderId: folder.id }).expect(201)
    expect((await readerAgent.get('/api/library/ids').expect(200)).body.data).toEqual([docId])
    expect((await db.query(`SELECT save_count FROM documents WHERE id = $1`, [docId])).rows[0].save_count).toBe(1)

    const inFolder = (await readerAgent.get(`/api/library?folder=${folder.id}`).expect(200)).body.data as LibraryPage
    expect(inFolder.data.map((i) => i.document.id)).toEqual([docId])
    expect(inFolder.data[0]).toMatchObject({ ownedByMe: false, folderId: folder.id })
    const folders = (await readerAgent.get('/api/library/folders').expect(200)).body.data as LibraryFolder[]
    expect(folders[0]).toMatchObject({ name: 'Ôn thi', itemCount: 1 })

    // Xóa thư mục ⇒ tài liệu về "chưa phân thư mục"
    await readerAgent.delete(`/api/library/folders/${folder.id}`).expect(200)
    expect(((await readerAgent.get('/api/library?folder=none').expect(200)).body.data as LibraryPage).data).toHaveLength(1)

    await db.query(`UPDATE documents SET visibility = 'private' WHERE id = $1`, [docId])
    expect(((await readerAgent.get('/api/library').expect(200)).body.data as LibraryPage).data).toHaveLength(0)
    await db.query(`UPDATE documents SET visibility = 'public' WHERE id = $1`, [docId])

    await readerAgent.delete(`/api/library/${docId}`).expect(200)
    expect((await db.query(`SELECT save_count FROM documents WHERE id = $1`, [docId])).rows[0].save_count).toBe(0)

    // Bản nháp của người khác không lưu được
    const { document: draft } = (await upload(authorAgent, 'nhap chua dang')) as DocumentUploadResult
    await readerAgent.post('/api/library').send({ documentId: draft.id }).expect(404)
  })

  it('tải tệp riêng vào kho: riêng tư, không bị dọn như bản nháp, chỉ chủ thấy', async () => {
    const owner = await createUser(db)
    const other = await createUser(db)
    const ownerAgent = await loginAgent(app, owner)
    const res = await upload(ownerAgent, 'ghi chu rieng', 'ghi_chu.pdf', '/api/library/upload')
    expect(res.item).toMatchObject({ ownedByMe: true, document: { status: 'published', listed: false } })
    const id = res.item.document.id
    expect((await db.query(`SELECT visibility FROM documents WHERE id = $1`, [id])).rows[0].visibility).toBe('private')

    const mine = (await ownerAgent.get('/api/library?scope=mine').expect(200)).body.data as LibraryPage
    expect(mine.data.map((i) => i.document.id)).toContain(id)
    await (await loginAgent(app, other)).get(`/api/documents/${id}/detail`).expect(404)
  })

  it('bình luận kèm tài liệu: bản nháp → published theo quyền xem của bài, hiện trong danh sách bình luận', async () => {
    const author = await createUser(db)
    const commenter = await createUser(db)
    const authorAgent = await loginAgent(app, author)
    const commenterAgent = await loginAgent(app, commenter)
    const post = (await authorAgent.post('/api/posts').send({ content: 'Ai có đề không?' }).expect(201)).body.data as PostItem

    const { document } = (await upload(commenterAgent, 'de tra loi')) as DocumentUploadResult
    const comment = (await commenterAgent.post(`/api/posts/${post.id}/comments`).send({ content: 'Đây nè', documentIds: [document.id] }).expect(201)).body
      .data as CommentItem
    expect(comment.documents?.[0]).toMatchObject({ id: document.id, status: 'published' })

    const list = (await authorAgent.get(`/api/posts/${post.id}/comments`).expect(200)).body.data as CommentItem[]
    expect(list.find((c) => c.id === comment.id)?.documents?.map((d) => d.id)).toEqual([document.id])

    // Lưu tài liệu từ bình luận vào kho
    await authorAgent.post('/api/library').send({ documentId: document.id }).expect(201)
  })

  it('trang Tài liệu & chi tiết: chỉ tài liệu trong kho; chi tiết kèm bài viết + cùng môn; chủ xóa được', async () => {
    const author = await createUser(db)
    const reader = await createUser(db)
    const authorAgent = await loginAgent(app, author)
    const readerAgent = await loginAgent(app, reader)
    const a = await publishListed(authorAgent, 'de A trang tai lieu')
    const b = await publishListed(authorAgent, 'de B trang tai lieu')

    const page = (await readerAgent.get(`/api/documents/browse?course=${courseCode}&category=final_exam&sort=newest`).expect(200)).body.data as DocumentListPage
    expect(page.data.map((d) => d.id).slice(0, 2)).toEqual([b, a])
    await readerAgent.get('/api/documents/browse?category=khong-co').expect(400)
    // Nhiều môn cách nhau bằng dấu phẩy (kệ "môn bạn theo dõi")
    const multi = (await readerAgent.get(`/api/documents/browse?course=ZZ999,${courseCode.toLowerCase()}&sort=newest`).expect(200)).body.data as DocumentListPage
    expect(multi.data.map((d) => d.id).slice(0, 2)).toEqual([b, a])

    const detail = (await readerAgent.get(`/api/documents/${a}/detail`).expect(200)).body.data as DocumentDetail
    expect(detail).toMatchObject({ id: a, isMine: false, isSaved: false, courseCode, ownerId: author.id })
    expect(detail.posts[0].excerpt).toContain('de A trang tai lieu')
    expect(detail.related.map((d) => d.id)).toContain(b)

    await readerAgent.delete(`/api/documents/${a}`).expect(404)
    await authorAgent.delete(`/api/documents/${a}`).expect(200)
    await readerAgent.get(`/api/documents/${a}/detail`).expect(404)
    const trashed = await db.query(`SELECT 1 FROM deleted_records WHERE table_name = 'documents' AND row_id = $1`, [a])
    expect(trashed.rowCount).toBe(1)
  })

  it('theo dõi môn học: bật / tắt idempotent, riêng từng người, cần đăng nhập, id lạ ⇒ 404', async () => {
    const user = await createUser(db)
    const other = await createUser(db)
    const agent = await loginAgent(app, user)
    await request(app.getHttpServer()).get('/api/courses/followed').expect(401)

    await agent.put(`/api/courses/${courseId}/follow`).expect(200)
    await agent.put(`/api/courses/${courseId}/follow`).expect(200)
    expect((await agent.get('/api/courses/followed').expect(200)).body.data).toEqual([courseId])
    expect((await (await loginAgent(app, other)).get('/api/courses/followed').expect(200)).body.data).toEqual([])

    await agent.delete(`/api/courses/${courseId}/follow`).expect(200)
    await agent.delete(`/api/courses/${courseId}/follow`).expect(200)
    expect((await agent.get('/api/courses/followed').expect(200)).body.data).toEqual([])

    await agent.put('/api/courses/00000000-0000-4000-8000-000000000000/follow').expect(404)
    await agent.put('/api/courses/khong-phai-uuid/follow').expect(400)
  })
})
