import type { NestExpressApplication } from '@nestjs/platform-express'
import * as request from 'supertest'
import type { DatabaseService } from '../src/database/database.service'
import { createTestApp, createUser, loginAgent } from './helpers'

// Chia sẻ công khai hội thoại N7AI qua link (docs/core/11-n7ai-space.md §Chia sẻ hội thoại)
describe('N7AI share link (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  async function insertMessage(convId: string, senderId: string, values: { kind?: string; content?: string; attachments?: unknown[]; blocks?: unknown[] }) {
    const res = await db.query(
      `INSERT INTO messages (conversation_id, sender_id, kind, content, attachments, blocks) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        convId,
        senderId,
        values.kind ?? 'text',
        values.content ?? '',
        values.attachments ? JSON.stringify(values.attachments) : null,
        values.blocks ? JSON.stringify(values.blocks) : null
      ]
    )
    await db.query(`UPDATE conversations SET last_message_id = $2, last_message_at = NOW() WHERE id = $1`, [convId, res.rows[0].id])
    return String(res.rows[0].id)
  }
  const citation = (type: string, id: string, title: string) => ({ type: 'citation', ref: { type, id }, title })

  it('Tạo link ⇒ ai cũng xem được ảnh chụp; nguồn riêng tư & tệp bị ẩn; cập nhật giữ token; ngắt ⇒ 404', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const bot = (await db.query(`SELECT id FROM users WHERE username = 'n7ai' AND account_type = 'bot'`)).rows[0].id
    const thread = (await agent.post('/api/ai/threads').expect(200)).body.data

    // Thread rỗng ⇒ chưa chia sẻ được
    expect((await agent.get(`/api/ai/threads/${thread.id}/share`).expect(200)).body.data).toBeNull()
    await agent.post(`/api/ai/threads/${thread.id}/share`).expect(400)

    const post = (
      await db.query(`INSERT INTO posts (author_id, title, content, visibility) VALUES ($1, 'Công khai', 'Bài công khai', 'public') RETURNING id`, [user.id])
    ).rows[0].id
    const privatePost = (
      await db.query(`INSERT INTO posts (author_id, title, content, visibility) VALUES ($1, 'Riêng', 'Bài riêng', 'private') RETURNING id`, [user.id])
    ).rows[0].id
    await insertMessage(thread.id, user.id, {
      content: 'Giải giúp bài này',
      attachments: [{ url: 'https://cdn.test/a.png', key: 'chat/x/a.png', name: 'a.png', size: 1, mime: 'image/png', kind: 'image' }]
    })
    await insertMessage(thread.id, bot, {
      kind: 'ai',
      content: 'Lời giải',
      blocks: [
        citation('post', post, 'Bài công khai'),
        citation('post', privatePost, 'Bài riêng'),
        citation('drive', 'file-1', 'Đề cương riêng'),
        citation('web', 'https://example.com', 'Example')
      ]
    })
    await insertMessage(thread.id, user.id, { kind: 'system', content: 'Chủ đề mới' })

    const share = (await agent.post(`/api/ai/threads/${thread.id}/share`).expect(200)).body.data
    expect(share).toMatchObject({ messageCount: 2, hasNewer: false })
    expect(share.token).toMatch(/^[A-Za-z0-9_-]{22}$/)

    // Không đăng nhập vẫn xem được
    const view = (await request(app.getHttpServer()).get(`/api/ai/shared/${share.token}`).expect(200)).body.data
    expect(view.messages.map((m: { role: string; content: string }) => [m.role, m.content])).toEqual([
      ['user', 'Giải giúp bài này'],
      ['ai', 'Lời giải']
    ])
    expect(view.messages[0]).toMatchObject({ attachmentCount: 1 })
    expect(JSON.stringify(view)).not.toContain('chat/x/a.png')
    expect(view.messages[1].citations.map((c: { ref: { id: string } }) => c.ref.id)).toEqual([post, 'https://example.com'])

    // Tin sau ảnh chụp không lộ cho tới khi cập nhật (token giữ nguyên)
    await insertMessage(thread.id, user.id, { content: 'Câu hỏi mới' })
    expect((await agent.get(`/api/ai/threads/${thread.id}/share`).expect(200)).body.data).toMatchObject({ hasNewer: true })
    expect((await request(app.getHttpServer()).get(`/api/ai/shared/${share.token}`).expect(200)).body.data.messages).toHaveLength(2)
    const updated = (await agent.post(`/api/ai/threads/${thread.id}/share`).expect(200)).body.data
    expect(updated).toMatchObject({ token: share.token, messageCount: 3, hasNewer: false })

    // Người khác không quản lý được link
    const other = await loginAgent(app, await createUser(db))
    await other.post(`/api/ai/threads/${thread.id}/share`).expect(404)
    await other.delete(`/api/ai/threads/${thread.id}/share`).expect(404)

    await agent.delete(`/api/ai/threads/${thread.id}/share`).expect(200)
    await request(app.getHttpServer()).get(`/api/ai/shared/${share.token}`).expect(404)
    await request(app.getHttpServer()).get('/api/ai/shared/not-a-token').expect(404)
  })
})
