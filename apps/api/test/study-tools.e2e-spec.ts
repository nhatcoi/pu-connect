import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { StudyToolsService } from '../src/modules/study-tools/study-tools.service'
import { createTestApp, createUser, loginAgent } from './helpers'

// Công cụ học tập (docs/core/15-study-tools.md): CRUD bộ, ôn flashcard, quiz, tự lưu từ câu trả lời N7AI
describe('Study tools (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  const cards = [
    { content: { front: 'Invisible (adj)', back: 'Vô hình' } },
    { content: { front: 'Physicist (n)', back: 'Nhà vật lý học' } }
  ]

  it('Tạo, sửa (giữ lịch ôn thẻ cũ), xóa bộ flashcard; người khác không xem được', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const created = (await agent.post('/api/tools/sets').send({ kind: 'flashcards', title: 'Từ vựng', items: cards }).expect(201)).body.data
    expect(created.itemCount).toBe(2)
    expect(created.dueCount).toBe(2) // thẻ mới = đến hạn

    const first = created.items[0]
    await agent.post(`/api/tools/sets/${created.id}/review`).send({ itemId: first.id, grade: 'good' }).expect(201)

    const updated = (
      await agent
        .patch(`/api/tools/sets/${created.id}`)
        .send({ kind: 'flashcards', title: 'Từ vựng 2', items: [{ id: first.id, content: first.content }, { content: { front: 'Atom', back: 'Nguyên tử' } }] })
        .expect(200)
    ).body.data
    expect(updated.title).toBe('Từ vựng 2')
    expect(updated.items.map((i: any) => i.content.front)).toEqual(['Invisible (adj)', 'Atom'])
    expect(updated.items[0].id).toBe(first.id)
    expect(updated.items[0].reps).toBe(1) // giữ lịch ôn
    expect(updated.dueCount).toBe(1)

    const other = await loginAgent(app, await createUser(db))
    await other.get(`/api/tools/sets/${created.id}`).expect(403)
    await other.delete(`/api/tools/sets/${created.id}`).expect(404)

    await agent.delete(`/api/tools/sets/${created.id}`).expect(204)
    await agent.get(`/api/tools/sets/${created.id}`).expect(404)
  })

  it('Từ chối mục sai định dạng theo loại bộ', async () => {
    const agent = await loginAgent(app, await createUser(db))
    await agent
      .post('/api/tools/sets')
      .send({ kind: 'quiz', title: 'Quiz', items: [{ content: { q: 'Câu?', options: ['A', 'B'], answer: 5 } }] })
      .expect(400)
    await agent.post('/api/tools/sets').send({ kind: 'flashcards', title: 'X', items: [{ content: { front: '', back: 'b' } }] }).expect(400)
  })

  it('Quiz: ghi điểm cao nhất; tổng quan đếm theo loại', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const quiz = (
      await agent
        .post('/api/tools/sets')
        .send({ kind: 'quiz', title: 'Giải tích', items: [{ content: { q: '1+1?', options: ['1', '2'], answer: 1 } }, { content: { q: '2+2?', options: ['4', '5'], answer: 0 } }] })
        .expect(201)
    ).body.data
    expect((await agent.post(`/api/tools/sets/${quiz.id}/attempts`).send({ correct: 2, total: 2 }).expect(201)).body.data.bestScore).toBe(100)
    expect((await agent.post(`/api/tools/sets/${quiz.id}/attempts`).send({ correct: 1, total: 2 }).expect(201)).body.data.bestScore).toBe(100)
    await agent.post(`/api/tools/sets/${quiz.id}/attempts`).send({ correct: 3, total: 2 }).expect(400)

    const overview = (await agent.get('/api/tools/overview').expect(200)).body.data
    expect(overview.kinds.find((k: any) => k.kind === 'quiz')).toMatchObject({ sets: 1, items: 2 })
    expect(overview.recent[0].id).toBe(quiz.id)
  })

  it('Tự lưu khối ```flashcards trong câu trả lời N7AI (1 tin ⇒ 1 bộ)', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const thread = (await agent.post('/api/ai/threads').expect(200)).body.data
    const bot = (await db.query(`SELECT id FROM users WHERE username = 'n7ai' AND account_type = 'bot'`)).rows[0].id
    const msg = (await db.query(`INSERT INTO messages (conversation_id, sender_id, kind, content) VALUES ($1, $2, 'ai', '') RETURNING id`, [thread.id, bot])).rows[0].id
    const text = 'Đây là bộ thẻ:\n```flashcards\n{"title": "Vũ trụ", "cards": [{"front": "Atom", "back": "Nguyên tử"}, {"front": "", "back": "bỏ"}]}\n```'

    const tools = app.get(StudyToolsService)
    const saved = await tools.saveFromReply(user.id, String(msg), text)
    expect(saved).toMatchObject({ kind: 'flashcards', title: 'Vũ trụ' })
    expect(await tools.saveFromReply(user.id, String(msg), text)).toBeNull()

    const list = (await agent.get('/api/tools/sets?kind=flashcards').expect(200)).body.data
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ source: 'n7ai', itemCount: 1, sourceMessageId: String(msg) })
  })
})
