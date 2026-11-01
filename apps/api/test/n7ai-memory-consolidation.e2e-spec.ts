import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { AiMemoriesService, parseFacts } from '../src/modules/chat/n7ai/ai-memories.service'
import { createTestApp, createUser, stubProviders } from './helpers'

// Hợp nhất bộ nhớ định kỳ: gộp dữ kiện trùng, giữ nguyên mục ghim / tự thêm / của học liệu
describe('N7AI memory consolidation (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  async function seed(userId: string, auto: number) {
    for (let i = 0; i < auto; i++) await db.query(`INSERT INTO ai_memories (user_id, content, source) VALUES ($1, $2, 'auto')`, [userId, `Dữ kiện tự động số ${i}`])
    await db.query(`INSERT INTO ai_memories (user_id, content, source, pinned) VALUES ($1, 'Ngành CNTT (ghim)', 'auto', TRUE)`, [userId])
    await db.query(`INSERT INTO ai_memories (user_id, content, source) VALUES ($1, 'Do người dùng tự thêm', 'manual')`, [userId])
  }
  const reply = (text: string, finish = 'stop') => ({
    chat: { completions: { create: jest.fn(async () => ({ choices: [{ message: { content: text }, finish_reason: finish }], usage: { prompt_tokens: 1, completion_tokens: 1 } })) } }
  })
  const rows = async (userId: string) => (await db.query(`SELECT content, source, pinned FROM ai_memories WHERE user_id = $1 ORDER BY content`, [userId])).rows

  it('gộp thành danh sách ngắn, giữ mục ghim và mục người dùng tự thêm', async () => {
    const user = await createUser(db)
    await seed(user.id, 35)
    const restore = stubProviders(app, reply('```json\n["Ưa học bằng ví dụ", "Thi giải tích tháng 12"]\n```'))
    try {
      expect(await app.get(AiMemoriesService).consolidate(user.id)).toBe(true)
    } finally {
      restore()
    }
    const left = await rows(user.id)
    expect(left.map((r) => r.content)).toEqual(['Do người dùng tự thêm', 'Ngành CNTT (ghim)', 'Thi giải tích tháng 12', 'Ưa học bằng ví dụ'])
    expect(left.find((r) => r.pinned)?.content).toBe('Ngành CNTT (ghim)')
  })

  it('kết quả hỏng, bị cắt hoặc rỗng ⇒ không đổi dữ liệu; ít dữ kiện ⇒ không gọi model', async () => {
    const user = await createUser(db)
    await seed(user.id, 35)
    const before = (await rows(user.id)).length
    for (const bad of [reply('không phải JSON'), reply('["a dữ kiện"]', 'length'), reply('[]')]) {
      const restore = stubProviders(app, bad)
      try {
        expect(await app.get(AiMemoriesService).consolidate(user.id)).toBe(false)
      } finally {
        restore()
      }
      expect((await rows(user.id)).length).toBe(before)
    }
    const few = await createUser(db)
    await seed(few.id, 5)
    const spy = reply('["x dữ kiện"]')
    const restore = stubProviders(app, spy)
    try {
      expect(await app.get(AiMemoriesService).consolidate(few.id)).toBe(false)
    } finally {
      restore()
    }
    expect(spy.chat.completions.create).not.toHaveBeenCalled()
  })

  it('parseFacts chỉ nhận mảng chuỗi hợp lệ', () => {
    expect(parseFacts('["Một dữ kiện", "Hai dữ kiện"]')).toEqual(['Một dữ kiện', 'Hai dữ kiện'])
    expect(parseFacts('{"a":1}')).toBeNull()
    expect(parseFacts('["ok ok", 3]')).toBeNull()
  })
})
