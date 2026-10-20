import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { htmlToText, isPrivateIp, WebReaderService } from '../src/modules/ai/connectors/web-reader.service'
import { AiDataService } from '../src/modules/chat/n7ai/ai-data.service'
import { AiMemoriesService } from '../src/modules/chat/n7ai/ai-memories.service'
import { nextRunAt } from '../src/modules/chat/n7ai/ai-tasks.schedule'
import { parseFollowUps, parseMemories } from '../src/modules/chat/n7ai/n7ai.followups'
import { createTestApp, createUser, loginAgent } from './helpers'

// Cài đặt N7AI (docs/core/10-n7ai-settings.md); LLM tắt trong test ⇒ N7AI trả lời "lỗi"
describe('N7AI settings (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  // Đợi N7AI (chạy nền) ghi xong câu trả lời
  async function waitAiReply(agent: Awaited<ReturnType<typeof loginAgent>>, convId: string) {
    for (let i = 0; i < 30; i++) {
      const res = await agent.get(`/api/conversations/${convId}/messages`)
      const ai = res.body.data.find((m: { kind: string; status: string }) => m.kind === 'ai' && m.status !== 'streaming')
      if (ai) return ai
      await new Promise((r) => setTimeout(r, 100))
    }
    throw new Error('no AI reply')
  }

  it('cài đặt: mặc định, cập nhật từng phần, kiểm tra hợp lệ', async () => {
    const agent = await loginAgent(app, await createUser(db))
    expect((await agent.get('/api/ai/settings').expect(200)).body.data).toEqual({
      aiModel: 'n7ai-fast',
      memoryEnabled: true,
      retentionDays: null,
      defaultConnectors: ['library', 'web', 'my_study', 'my_chats'],
      profile: { goal: null, about: null, style: null }
    })
    await agent.patch('/api/ai/settings').send({ retentionDays: 30 }).expect(200)
    const s = (
      await agent
        .patch('/api/ai/settings')
        .send({ memoryEnabled: false, defaultConnectors: ['library', 'my_documents'] })
        .expect(200)
    ).body.data
    expect(s).toMatchObject({ memoryEnabled: false, retentionDays: 30, defaultConnectors: ['library', 'my_documents'] })
    // Mức model: lưu được, giữ nguyên khi cập nhật trường khác, tên lạ ⇒ 400
    expect((await agent.patch('/api/ai/settings').send({ aiModel: 'n7ai-perfect' }).expect(200)).body.data.aiModel).toBe('n7ai-perfect')
    expect((await agent.patch('/api/ai/settings').send({ memoryEnabled: true }).expect(200)).body.data.aiModel).toBe('n7ai-perfect')
    await agent.patch('/api/ai/settings').send({ aiModel: 'gpt-x' }).expect(400)
    await agent.patch('/api/ai/settings').send({ retentionDays: 7 }).expect(400)
    await agent.patch('/api/ai/settings').send({ defaultConnectors: [] }).expect(400)
  })

  it('bộ nhớ: dòng [nhớ] tách khỏi gợi ý, lưu bỏ trùng, nhớ lại theo câu hỏi, CRUD', async () => {
    const tail = '\n[nhớ] Học ngành CNTT khóa K17\n- Đệ quy đuôi là gì?\n[nhớ] Sắp thi Giải tích 2 ngày 20/10\n- Ví dụ khác?'
    expect(parseMemories(tail)).toEqual(['Học ngành CNTT khóa K17', 'Sắp thi Giải tích 2 ngày 20/10'])
    expect(parseFollowUps(tail)).toEqual(['Đệ quy đuôi là gì?', 'Ví dụ khác?'])

    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const svc = app.get(AiMemoriesService)
    expect(await svc.saveFromReply(user.id, null as unknown as string, ['Học ngành CNTT khóa K17', 'Sắp thi Giải tích 2 ngày 20/10'])).toHaveLength(2)
    expect(await svc.saveFromReply(user.id, null as unknown as string, ['Học ngành CNTT khóa K17.'])).toEqual([]) // trùng
    expect((await svc.recall(user.id, 'ôn thi giải tích thế nào'))[0]).toContain('Giải tích 2')

    const created = (await agent.post('/api/ai/memories').send({ content: 'Thích ví dụ Python' }).expect(201)).body.data
    expect(created.source).toBe('manual')
    await agent.patch(`/api/ai/memories/${created.id}`).send({ content: 'Thích ví dụ Python ngắn' }).expect(200)
    expect((await agent.get('/api/ai/memories').expect(200)).body.data).toHaveLength(3)
    await agent.delete(`/api/ai/memories/${created.id}`).expect(200)
    await agent.delete('/api/ai/memories').expect(200)
    expect((await agent.get('/api/ai/memories').expect(200)).body.data).toHaveLength(0)
    const other = await loginAgent(app, await createUser(db))
    await other.delete(`/api/ai/memories/${created.id}`).expect(404)
  })

  it('tác vụ tự động: lịch giờ VN, CRUD, chạy ngay ghi thread riêng, 3 lần lỗi ⇒ tự tạm dừng', async () => {
    // 2026-10-16 14:00 UTC = 21:00 VN (thứ Sáu)
    const now = new Date('2026-10-16T14:00:00Z')
    expect(nextRunAt({ frequency: 'daily', runTime: '21:30' }, now).toISOString()).toBe('2026-10-16T14:30:00.000Z')
    expect(nextRunAt({ frequency: 'daily', runTime: '21:00' }, now).toISOString()).toBe('2026-10-17T14:00:00.000Z')
    expect(nextRunAt({ frequency: 'weekly', runTime: '07:00', weekday: 1 }, now).toISOString()).toBe('2026-10-19T00:00:00.000Z')

    const agent = await loginAgent(app, await createUser(db))
    const body = { title: 'Ôn tối', prompt: 'Tóm tắt lịch mai và gợi ý ôn', frequency: 'daily', runTime: '21:00' }
    await agent
      .post('/api/ai/tasks')
      .send({ ...body, frequency: 'weekly' })
      .expect(400) // thiếu thứ
    const task = (await agent.post('/api/ai/tasks').send(body).expect(201)).body.data
    expect(task).toMatchObject({ enabled: true, weekday: null, conversationId: null })

    for (let i = 0; i < 3; i++) await agent.post(`/api/ai/tasks/${task.id}/run`).expect(200)
    const after = (await agent.get('/api/ai/tasks').expect(200)).body.data[0]
    expect(after).toMatchObject({ lastStatus: 'error', enabled: false })
    const thread = (await agent.get(`/api/conversations/${after.conversationId}`).expect(200)).body.data
    expect(thread.title).toBe('⏰ Ôn tối')
    const msgs = (await agent.get(`/api/conversations/${after.conversationId}/messages`).expect(200)).body.data
    expect(msgs.find((m: { meta: { task?: { id: string } } | null }) => m.meta?.task?.id === task.id)).toBeTruthy()

    // Sửa ⇒ bật lại, xóa đếm lỗi
    const edited = (
      await agent
        .patch(`/api/ai/tasks/${task.id}`)
        .send({ ...body, enabled: true })
        .expect(200)
    ).body.data
    expect(edited.enabled).toBe(true)
    await agent.delete(`/api/ai/tasks/${task.id}`).expect(200)
  })

  it('skill: tắt ⇒ không gọi được, ghim lên đầu', async () => {
    const agent = await loginAgent(app, await createUser(db))
    const mk = (slug: string) => agent.post('/api/ai/skills').send({ slug, name: slug, instructions: 'Chỉ dẫn đủ dài cho skill.' }).expect(201)
    await mk('mot')
    const b = (await mk('hai')).body.data
    await agent.patch(`/api/ai/skills/${b.id}/state`).send({ pinned: true }).expect(200)
    expect((await agent.get('/api/ai/skills').expect(200)).body.data[0].id).toBe(b.id)
    await agent.patch(`/api/ai/skills/${b.id}/state`).send({ enabled: false }).expect(200)
    const conv = (await agent.post('/api/conversations/ai').expect(200)).body.data
    await agent.post(`/api/conversations/${conv.id}/messages`).send({ content: 'x', skillId: b.id }).expect(400)
    await agent.patch(`/api/ai/skills/${b.id}/state`).send({}).expect(400)
  })

  it('phản hồi 👍/👎 lưu vào meta, hỗ trợ kèm ngữ cảnh, lượt dùng 7 ngày, thống kê admin', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const conv = (await agent.post('/api/ai/threads').expect(200)).body.data
    await agent.post(`/api/conversations/${conv.id}/messages`).send({ content: 'Đệ quy là gì?' }).expect(201)
    const ai = await waitAiReply(agent, conv.id)
    await agent.post(`/api/ai/messages/${ai.id}/feedback`).send({ rating: -1, reason: 'wrong', comment: 'sai ví dụ' }).expect(200)
    const updated = (await agent.get(`/api/conversations/${conv.id}/messages`).expect(200)).body.data.find((m: { id: string }) => m.id === ai.id)
    expect(updated.meta.feedback).toBe(-1)
    const stranger = await loginAgent(app, await createUser(db))
    await stranger.post(`/api/ai/messages/${ai.id}/feedback`).send({ rating: 1 }).expect(404)
    await agent.post('/api/ai/messages/abc/feedback').send({ rating: 1 }).expect(400)

    const ticket = (
      await agent
        .post('/api/ai/support')
        .send({ category: 'wrong_answer', message: 'N7AI giải sai bài đệ quy', conversationId: conv.id, includeContext: true })
        .expect(201)
    ).body.data
    const row = await db.query(`SELECT jsonb_array_length(context) AS n FROM ai_support_tickets WHERE id = $1`, [ticket.id])
    expect(row.rows[0].n).toBeGreaterThan(0)
    await stranger.post('/api/ai/support').send({ category: 'bug', message: 'xem trộm hội thoại', conversationId: conv.id, includeContext: true }).expect(403)

    const usage = (await agent.get('/api/ai/usage').expect(200)).body.data
    expect(usage.days).toHaveLength(7)
    expect(usage.days[6].count).toBe(usage.used)

    await agent.get('/api/admin/ai-feedback').expect(403)
    const admin = await loginAgent(app, await createUser(db, { role: 'admin' }))
    const stats = (await admin.get('/api/admin/ai-feedback').expect(200)).body.data
    expect(stats.down).toBeGreaterThanOrEqual(1)
    expect(stats.tickets.length).toBeGreaterThanOrEqual(1)
  })

  it('dữ liệu: xuất JSON, xóa lịch sử quá hạn, xóa toàn bộ', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const conv = (await agent.post('/api/ai/threads').expect(200)).body.data
    await agent.post(`/api/conversations/${conv.id}/messages`).send({ content: 'Câu hỏi cũ' }).expect(201)
    await waitAiReply(agent, conv.id)
    await agent.post('/api/ai/memories').send({ content: 'Thích học buổi tối' }).expect(201)

    const exported = (await agent.get('/api/ai/data/export').expect(200)).body.data
    expect(exported.threads[0].messages[0]).toMatchObject({ role: 'user', content: 'Câu hỏi cũ' })
    expect(exported.memories).toHaveLength(1)

    // Lưu 30 ngày + thread im 40 ngày ⇒ bị dọn
    await agent.patch('/api/ai/settings').send({ retentionDays: 30 }).expect(200)
    await db.query(`UPDATE conversations SET last_message_at = NOW() - interval '40 days' WHERE id = $1`, [conv.id])
    expect(await app.get(AiDataService).purgeExpired()).toBeGreaterThanOrEqual(1)
    await agent.get(`/api/conversations/${conv.id}`).expect(404)

    await agent.post('/api/ai/skills').send({ slug: 'xoa', name: 'x', instructions: 'Chỉ dẫn đủ dài cho skill.' }).expect(201)
    await agent.delete('/api/ai/data').expect(200)
    expect((await agent.get('/api/ai/memories').expect(200)).body.data).toHaveLength(0)
    expect((await agent.get('/api/ai/skills').expect(200)).body.data).toHaveLength(0)
    expect((await agent.get('/api/ai/settings').expect(200)).body.data.retentionDays).toBeNull()
  })

  it('đọc trang web: chặn SSRF, trích chữ HTML', async () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:127.0.0.1', '0.0.0.0']) {
      expect(isPrivateIp(ip)).toBe(true)
    }
    expect(isPrivateIp('8.8.8.8')).toBe(false)
    const reader = app.get(WebReaderService)
    expect(await reader.readUrls('đọc http://127.0.0.1:3000/admin và http://169.254.169.254/latest/meta-data', 4000)).toEqual([])
    expect(await reader.readUrls('file:///etc/passwd', 4000)).toEqual([])

    const { title, text } = htmlToText(
      '<html><head><title>Đệ quy &amp; vòng lặp</title><script>evil()</script></head><body><nav>menu</nav><article><h1>Đệ quy</h1><p>Hàm gọi lại chính nó.</p></article></body></html>'
    )
    expect(title).toBe('Đệ quy & vòng lặp')
    expect(text).toContain('Hàm gọi lại chính nó.')
    expect(text).not.toMatch(/evil|menu/)
  })
})
