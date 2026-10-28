import type { NestExpressApplication } from '@nestjs/platform-express'
import type { AttachedDocument, DocumentUploadResult, PostItem } from '@pu/schemas'
import type { DatabaseService } from '../src/database/database.service'
import { DocumentsService } from '../src/modules/documents/documents.service'
import { StorageService } from '../src/modules/storage/storage.service'
import * as request from 'supertest'
import { createTestApp, createUser, loginAgent } from './helpers'

// Kho tài liệu: đính kèm khi soạn bài (bản nháp) → phân loại → đăng bài → vào kho môn học
describe('Document library (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService
  let courseId: string
  let seq = 0

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
    // Không gọi R2 thật trong test
    const storage = app.get(StorageService)
    jest.spyOn(storage, 'uploadFile').mockImplementation(async (buf: Buffer, name: string) => {
      const key = `documents/test/${Date.now()}_${String(++seq).padStart(6, '0')}_${name}`
      return { url: storage.publicUrlFor(key), key, size: buf.length }
    })
    courseId = (await db.query(`INSERT INTO courses (code, name, credits) VALUES ('DOC' || floor(random() * 1e6)::text, 'Môn thử', 3) RETURNING id`)).rows[0].id
  })
  afterAll(async () => {
    await app.close()
  })

  type Agent = Awaited<ReturnType<typeof loginAgent>>
  const upload = async (agent: Agent, body: string, name = 'De_thi_cuoi_ky.pdf') =>
    (await agent.post('/api/documents/upload').attach('file', Buffer.from(body), { filename: name, contentType: 'application/pdf' }).expect(201)).body
      .data as DocumentUploadResult

  it('tải lên tạo bản nháp riêng tư; người khác không xem được; ảnh bị từ chối', async () => {
    const owner = await createUser(db)
    const other = await createUser(db)
    const ownerAgent = await loginAgent(app, owner)
    const otherAgent = await loginAgent(app, other)

    const { document: doc, duplicateOf } = await upload(ownerAgent, 'noi dung de thi A')
    expect(doc).toMatchObject({ status: 'draft', listed: false, docCategory: null, title: 'De thi cuoi ky', mimeType: 'application/pdf' })
    expect(duplicateOf).toBeNull()

    await otherAgent.get(`/api/documents/${doc.id}`).expect(404)
    await ownerAgent.get(`/api/documents/${doc.id}`).expect(200)
    await ownerAgent
      .post('/api/documents/upload')
      .attach('file', Buffer.from('png'), { filename: 'a.png', contentType: 'image/png' })
      .expect(400)
  })

  it('phân loại: vào kho cần môn + loại; chỉ chủ tài liệu được sửa', async () => {
    const owner = await createUser(db)
    const other = await createUser(db)
    const ownerAgent = await loginAgent(app, owner)
    const otherAgent = await loginAgent(app, other)
    const { document: doc } = await upload(ownerAgent, 'slide chuong 1')

    await ownerAgent.patch(`/api/documents/${doc.id}`).send({ listed: true }).expect(400)
    await ownerAgent.patch(`/api/documents/${doc.id}`).send({ docCategory: 'không-có' }).expect(400)
    await otherAgent.patch(`/api/documents/${doc.id}`).send({ courseId }).expect(403)

    const classified = (await ownerAgent.patch(`/api/documents/${doc.id}`).send({ courseId, docCategory: 'final_exam', academicYear: '2025-2026', listed: true }).expect(200))
      .body.data as AttachedDocument
    expect(classified).toMatchObject({ courseId, docCategory: 'final_exam', academicYear: '2025-2026', listed: true })

    // Bỏ môn ⇒ tự rời kho
    const unlisted = (await ownerAgent.patch(`/api/documents/${doc.id}`).send({ courseId: null }).expect(200)).body.data as AttachedDocument
    expect(unlisted.listed).toBe(false)
  })

  it('đăng bài kèm tài liệu: bản nháp → published + thẻ trong bài; vào kho môn học; tài liệu người khác bị từ chối', async () => {
    const owner = await createUser(db)
    const other = await createUser(db)
    const ownerAgent = await loginAgent(app, owner)
    const otherAgent = await loginAgent(app, other)

    const { document: listedDoc } = await upload(ownerAgent, 'de giua ky 2025')
    await ownerAgent.patch(`/api/documents/${listedDoc.id}`).send({ courseId, docCategory: 'midterm_exam', listed: true }).expect(200)
    const { document: plainDoc } = await upload(ownerAgent, 'ghi chu ca nhan', 'ghi_chu.pdf')

    const post = (
      await ownerAgent
        .post('/api/posts')
        .send({ content: 'Chia sẻ đề giữa kỳ', postType: 'document', documentIds: [listedDoc.id, plainDoc.id] })
        .expect(201)
    ).body.data as PostItem
    expect(post.documents?.map((d) => d.id)).toEqual([listedDoc.id, plainDoc.id])
    expect(post.documents?.[0]).toMatchObject({ status: 'published', listed: true, docCategory: 'midterm_exam' })
    expect(post.documents?.[1]).toMatchObject({ status: 'published', listed: false })
    expect(post.attachedDocumentIds).toHaveLength(2)

    const fetched = (await otherAgent.get(`/api/posts/${post.id}`).expect(200)).body.data as PostItem
    expect(fetched.documents?.map((d) => d.id)).toEqual([listedDoc.id, plainDoc.id])
    await otherAgent.get(`/api/documents/${plainDoc.id}`).expect(200)

    // Kho môn học chỉ có tài liệu đã phân loại
    const courseDocs = (await otherAgent.get(`/api/documents?course=${courseId}`).expect(200)).body.data as { id: string }[]
    expect(courseDocs.map((d) => d.id)).toContain(listedDoc.id)
    expect(courseDocs.map((d) => d.id)).not.toContain(plainDoc.id)

    // Bản nháp của người khác không gắn được vào bài mình
    const { document: foreign } = await upload(otherAgent, 'nhap cua nguoi khac')
    await ownerAgent.post('/api/posts').send({ content: 'Lấy tài liệu người khác', documentIds: [foreign.id] }).expect(400)
  })

  it('tệp trùng nội dung: báo tài liệu công khai đã có; dùng lại được trong bài của người khác', async () => {
    const first = await createUser(db)
    const second = await createUser(db)
    const firstAgent = await loginAgent(app, first)
    const secondAgent = await loginAgent(app, second)

    const { document: original } = await upload(firstAgent, 'de thi trung nhau 2024')
    await firstAgent.patch(`/api/documents/${original.id}`).send({ courseId, docCategory: 'final_exam', listed: true }).expect(200)
    await firstAgent.post('/api/posts').send({ content: 'Đề cuối kỳ 2024', documentIds: [original.id] }).expect(201)

    const again = await upload(secondAgent, 'de thi trung nhau 2024', 'ban_sao.pdf')
    expect(again.duplicateOf).toMatchObject({ id: original.id })

    const post = (await secondAgent.post('/api/posts').send({ content: 'Đề này hay', documentIds: [original.id] }).expect(201)).body.data as PostItem
    expect(post.documents?.[0]).toMatchObject({ id: original.id, listed: true })
    const owner = await db.query(`SELECT owner_id FROM documents WHERE id = $1`, [original.id])
    expect(owner.rows[0].owner_id).toBe(first.id)
  })

  it('bài riêng tư: tài liệu không vào kho; bản nháp bỏ quá hạn bị dọn; tài liệu ngoài R2 bị từ chối', async () => {
    const owner = await createUser(db)
    const ownerAgent = await loginAgent(app, owner)
    const { document: doc } = await upload(ownerAgent, 'tai lieu rieng')
    await ownerAgent.patch(`/api/documents/${doc.id}`).send({ courseId, docCategory: 'exercise', listed: true }).expect(200)
    const post = (await ownerAgent.post('/api/posts').send({ content: 'Chỉ mình tôi', visibility: 'private', documentIds: [doc.id] }).expect(201)).body
      .data as PostItem
    expect(post.documents?.[0]).toMatchObject({ listed: false })

    const { document: stale } = await upload(ownerAgent, 'nhap bi bo')
    await db.query(`UPDATE documents SET created_at = NOW() - INTERVAL '2 days' WHERE id = $1`, [stale.id])
    await app.get(DocumentsService).purgeDrafts()
    expect((await db.query(`SELECT 1 FROM documents WHERE id = $1`, [stale.id])).rowCount).toBe(0)

    await ownerAgent
      .post('/api/documents')
      .send({ title: 'Link ngoài', fileUrl: 'https://evil.example/a.pdf', fileSize: 10, mimeType: 'application/pdf', courseId, docCategory: 'other' })
      .expect(400)
  })

  it('GraphQL documents không lộ email và bỏ tài liệu riêng tư', async () => {
    const owner = await createUser(db)
    const ownerAgent = await loginAgent(app, owner)
    const { document: draft } = await upload(ownerAgent, 'nhap graphql')
    const res = await ownerAgent
      .post('/graphql')
      .send({ query: '{ documents { id uploader { email } } }' })
      .expect(200)
    const docs = res.body.data.documents as { id: string; uploader: { email: string } }[]
    expect(docs.map((d) => d.id)).not.toContain(draft.id)
    for (const d of docs) expect(d.uploader.email).toBe('')
  })

  it('N7AI gợi ý cho tệp chưa thành tài liệu: cần đăng nhập, kiểm tra dữ liệu; test không có model ⇒ 503', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const url = app.get(StorageService).publicUrlFor('documents/test/x.pdf')
    const body = { fileUrl: url, fileName: 'De_thi.pdf', mimeType: 'application/pdf' }
    await agent.post('/api/documents/suggest-file').send({ fileName: 'x' }).expect(400)
    await request(app.getHttpServer()).post('/api/documents/suggest-file').send(body).expect(401)
    await agent.post('/api/documents/suggest-file').send(body).expect(503)
  })
})
