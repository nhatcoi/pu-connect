import * as request from 'supertest'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { CoursePath, DocumentCollectionDetail, DocumentDetail, DocumentUploadResult } from '@pu/schemas'
import type { DatabaseService } from '../src/database/database.service'
import { StorageService } from '../src/modules/storage/storage.service'
import { createTestApp, createUser, loginAgent } from './helpers'

// Cộng đồng tài liệu: đánh giá sao, bộ sưu tập, lộ trình học của môn
describe('Document community — ratings, collections, course path (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService
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
    courseCode = `COM${Math.floor(Math.random() * 1e6)}`
    courseId = (await db.query(`INSERT INTO courses (code, name, credits) VALUES ($1, 'Môn cộng đồng', 3) RETURNING id`, [courseCode])).rows[0].id
  })
  afterAll(async () => {
    await app.close()
  })

  type Agent = Awaited<ReturnType<typeof loginAgent>>
  const publish = async (agent: Agent, body: string, docCategory = 'final_exam', academicYear?: string) => {
    const { document } = (await agent.post('/api/documents/upload').attach('file', Buffer.from(body), { filename: 'tl.pdf', contentType: 'application/pdf' }).expect(201)).body.data as DocumentUploadResult
    await agent.patch(`/api/documents/${document.id}`).send({ courseId, docCategory, academicYear, listed: true }).expect(200)
    await agent.post('/api/posts').send({ content: `Chia sẻ ${body}`, documentIds: [document.id] }).expect(201)
    return document.id as string
  }

  it('đánh giá sao: không tự chấm, đổi được, tính lại trung bình, bỏ chấm', async () => {
    const author = await createUser(db)
    const a = await loginAgent(app, await createUser(db))
    const b = await loginAgent(app, await createUser(db))
    const authorAgent = await loginAgent(app, author)
    const id = await publish(authorAgent, 'de rating')

    await authorAgent.put(`/api/documents/${id}/rating`).send({ rating: 5 }).expect(403)
    await a.put(`/api/documents/${id}/rating`).send({ rating: 6 }).expect(400)
    await request401(app, id)

    expect((await a.put(`/api/documents/${id}/rating`).send({ rating: 5 }).expect(200)).body.data).toEqual({ ratingAvg: 5, ratingCount: 1, myRating: 5 })
    expect((await b.put(`/api/documents/${id}/rating`).send({ rating: 2 }).expect(200)).body.data).toEqual({ ratingAvg: 3.5, ratingCount: 2, myRating: 2 })
    // Đổi điểm không tăng số lượt
    expect((await b.put(`/api/documents/${id}/rating`).send({ rating: 4 }).expect(200)).body.data).toEqual({ ratingAvg: 4.5, ratingCount: 2, myRating: 4 })

    const detail = (await b.get(`/api/documents/${id}/detail`).expect(200)).body.data as DocumentDetail
    expect(detail).toMatchObject({ ratingAvg: 4.5, ratingCount: 2, myRating: 4 })
    expect((await a.delete(`/api/documents/${id}/rating`).expect(200)).body.data).toEqual({ ratingAvg: 4, ratingCount: 1, myRating: null })
  })

  it('bộ sưu tập: chủ tạo / thêm / bỏ tài liệu, bộ riêng tư không lộ, người khác không sửa được', async () => {
    const owner = await loginAgent(app, await createUser(db))
    const other = await loginAgent(app, await createUser(db))
    const author = await loginAgent(app, await createUser(db))
    const d1 = await publish(author, 'bo suu tap 1')
    const d2 = await publish(author, 'bo suu tap 2')

    const pub = (await owner.post('/api/collections').send({ title: 'Ôn thi cuối kỳ', visibility: 'public' }).expect(201)).body.data
    const priv = (await owner.post('/api/collections').send({ title: 'Của riêng tôi', visibility: 'private' }).expect(201)).body.data
    await owner.post('/api/collections').send({ title: '' }).expect(400)

    await owner.put(`/api/collections/${pub.id}/documents/${d1}`).expect(200)
    await owner.put(`/api/collections/${pub.id}/documents/${d1}`).expect(200) // idempotent
    await owner.put(`/api/collections/${pub.id}/documents/${d2}`).expect(200)
    await other.put(`/api/collections/${pub.id}/documents/${d1}`).expect(403)

    const detail = (await other.get(`/api/collections/${pub.id}`).expect(200)).body.data as DocumentCollectionDetail
    expect(detail).toMatchObject({ title: 'Ôn thi cuối kỳ', itemCount: 2, isMine: false })
    expect(detail.documents.map((d) => d.id)).toEqual([d2, d1])
    expect(detail.covers).toHaveLength(2)

    await other.get(`/api/collections/${priv.id}`).expect(404)
    const membership = (await owner.get(`/api/collections/membership?documentId=${d1}`).expect(200)).body.data as { id: string; hasDocument: boolean }[]
    expect(membership.find((m) => m.id === pub.id)?.hasDocument).toBe(true)
    expect(membership.find((m) => m.id === priv.id)?.hasDocument).toBe(false)

    // Danh sách công khai: có bộ có tài liệu, không có bộ riêng tư / bộ rỗng
    const list = (await other.get('/api/collections?scope=public').expect(200)).body.data.data as { id: string }[]
    expect(list.map((c) => c.id)).toContain(pub.id)
    expect(list.map((c) => c.id)).not.toContain(priv.id)
    expect((await other.get('/api/collections?scope=mine').expect(200)).body.data.data).toEqual([])

    await owner.delete(`/api/collections/${pub.id}/documents/${d1}`).expect(200)
    expect(((await owner.get(`/api/collections/${pub.id}`).expect(200)).body.data as DocumentCollectionDetail).itemCount).toBe(1)
    await other.delete(`/api/collections/${pub.id}`).expect(403)
    await owner.delete(`/api/collections/${pub.id}`).expect(200)
    await owner.get(`/api/collections/${pub.id}`).expect(404)
  })

  it('lộ trình học: bước theo thứ tự ôn, đề thi gom theo năm học', async () => {
    const agent = await loginAgent(app, await createUser(db))
    const slide = await publish(agent, 'slide path', 'lecture_slide')
    const syllabus = await publish(agent, 'de cuong path', 'syllabus')
    const e1 = await publish(agent, 'de 2023', 'final_exam', '2023-2024')
    const e2 = await publish(agent, 'de 2024', 'midterm_exam', '2024-2025')

    const path = (await agent.get(`/api/documents/course-path?course=${courseCode.toLowerCase()}`).expect(200)).body.data as CoursePath
    const order = path.steps.map((s) => s.category).filter((c) => ['syllabus', 'lecture_slide', 'midterm_exam', 'final_exam'].includes(c))
    expect(order).toEqual(['syllabus', 'lecture_slide', 'midterm_exam', 'final_exam'])
    expect(path.steps.find((s) => s.category === 'lecture_slide')?.items.map((d) => d.id)).toContain(slide)
    expect(path.steps.find((s) => s.category === 'syllabus')?.items.map((d) => d.id)).toContain(syllabus)
    expect(path.exams.map((y) => y.academicYear).slice(0, 2)).toEqual(['2024-2025', '2023-2024'])
    expect(path.exams[0].documents.map((d) => d.id)).toContain(e2)
    expect(path.exams[1].documents.map((d) => d.id)).toContain(e1)
    await agent.get('/api/documents/course-path').expect(400)
  })
})

// Chưa đăng nhập không chấm được
async function request401(app: NestExpressApplication, id: string) {
  await request(app.getHttpServer()).put(`/api/documents/${id}/rating`).send({ rating: 3 }).expect(401)
}
