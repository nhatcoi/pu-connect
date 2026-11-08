import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { createTestApp, createUser, loginAgent, stubProviders } from './helpers'

const reply = (text: string) => ({
  chat: { completions: { create: jest.fn(async () => ({ choices: [{ message: { content: text }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1 } })) } }
})

// Cộng đồng: bài ghim, tài liệu chia sẻ, thông báo bài mới, nhóm chat, hỏi N7AI
describe('Community features (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService
  let n = 0

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  type Agent = Awaited<ReturnType<typeof loginAgent>>
  // Chủ + thành viên + người ngoài; cộng đồng đã active
  async function setup() {
    const ownerUser = await createUser(db)
    const memberUser = await createUser(db)
    const outsider = await createUser(db)
    const slug = `cf-${Date.now().toString(36)}-${++n}`
    const c = (
      await db.query(`INSERT INTO communities (slug, name, description, status, created_by) VALUES ($1, 'Nhóm thử', 'Mô tả nhóm thử nghiệm', 'active', $2) RETURNING id`, [slug, ownerUser.id])
    ).rows[0].id as string
    await db.query(`INSERT INTO community_members (community_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'member')`, [c, ownerUser.id, memberUser.id])
    const [owner, member, out] = await Promise.all([loginAgent(app, ownerUser), loginAgent(app, memberUser), loginAgent(app, outsider)])
    return { slug, c, ownerUser, memberUser, owner, member, out }
  }
  const post = async (agent: Agent, communityId: string, content: string) =>
    (await agent.post('/api/posts').send({ content, communityId }).expect(201)).body.data.id as string

  it('ghim bài: chỉ chủ/điều hành viên, tối đa 3, chỉ bài của cộng đồng', async () => {
    const { slug, c, owner, member } = await setup()
    const ids = [await post(owner, c, 'Bài một về giải tích'), await post(member, c, 'Bài hai về đại số'), await post(member, c, 'Bài ba'), await post(member, c, 'Bài bốn')]
    await member.put(`/api/communities/${slug}/pins/${ids[0]}`).expect(403)
    for (const id of ids.slice(0, 3)) await owner.put(`/api/communities/${slug}/pins/${id}`).expect(200)
    await owner.put(`/api/communities/${slug}/pins/${ids[3]}`).expect(400) // quá 3 bài
    const pins = (await member.get(`/api/communities/${slug}/pins`).expect(200)).body.data
    expect(pins).toHaveLength(3)
    const foreign = (await owner.post('/api/posts').send({ content: 'Bài ngoài cộng đồng' }).expect(201)).body.data.id
    await owner.delete(`/api/communities/${slug}/pins/${ids[0]}`).expect(200)
    await owner.put(`/api/communities/${slug}/pins/${foreign}`).expect(404)
  })

  it('tài liệu: thành viên chia sẻ tài liệu công khai của mình, gỡ theo quyền', async () => {
    const { slug, memberUser, owner, member, out } = await setup()
    const mk = async (owner_id: string, vis: string) =>
      (await db.query(`INSERT INTO documents (owner_id, title, file_url, status, visibility) VALUES ($1, 'Đề cương', 'https://x/y.pdf', 'published', $2) RETURNING id`, [owner_id, vis])).rows[0].id as string
    const pub = await mk(memberUser.id, 'public')
    const priv = await mk(memberUser.id, 'private')

    await out.post(`/api/communities/${slug}/documents`).send({ documentId: pub }).expect(403) // không phải thành viên
    await member.post(`/api/communities/${slug}/documents`).send({ documentId: priv }).expect(400)
    await owner.post(`/api/communities/${slug}/documents`).send({ documentId: pub }).expect(403) // không phải tài liệu của chủ
    await member.post(`/api/communities/${slug}/documents`).send({ documentId: pub }).expect(200)
    await member.post(`/api/communities/${slug}/documents`).send({ documentId: pub }).expect(409)

    const cands = (await member.get(`/api/communities/${slug}/documents/candidates`).expect(200)).body.data
    expect(cands.map((d: { id: string }) => d.id)).not.toContain(pub)
    const list = (await out.get(`/api/communities/${slug}/documents`).expect(200)).body.data
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id: pub, title: 'Đề cương' })

    await out.delete(`/api/communities/${slug}/documents/${pub}`).expect(403)
    await owner.delete(`/api/communities/${slug}/documents/${pub}`).expect(200) // chủ gỡ được
    expect((await member.get(`/api/communities/${slug}/documents`).expect(200)).body.data).toHaveLength(0)
  })

  it('thông báo bài mới: thành viên bật chuông nhận, tắt thì không', async () => {
    const { slug, c, memberUser, owner, member } = await setup()
    expect((await member.get(`/api/communities/${slug}/notify`).expect(200)).body.data.enabled).toBe(true)
    await post(owner, c, 'Thông báo cho cả nhóm')
    await new Promise((r) => setTimeout(r, 300)) // fan-out chạy nền sau khi đăng
    const count = async () => (await db.query(`SELECT COUNT(*)::int AS n FROM notifications WHERE recipient_id = $1 AND type = 'community_post'`, [memberUser.id])).rows[0].n
    expect(await count()).toBe(1)

    await member.put(`/api/communities/${slug}/notify`).send({ enabled: false }).expect(200)
    await db.query(`DELETE FROM notifications WHERE recipient_id = $1`, [memberUser.id])
    await post(owner, c, 'Bài thứ hai')
    await new Promise((r) => setTimeout(r, 300))
    expect(await count()).toBe(0)
  })

  it('nhóm chat: chỉ thành viên mở, idempotent, rời cộng đồng thì rời chat', async () => {
    const { slug, owner, member, out } = await setup()
    await out.post(`/api/communities/${slug}/chat`).expect(403)
    const a = (await owner.post(`/api/communities/${slug}/chat`).expect(200)).body.data
    const b = (await member.post(`/api/communities/${slug}/chat`).expect(200)).body.data
    expect(b.id).toBe(a.id)
    expect((await owner.post(`/api/communities/${slug}/chat`).expect(200)).body.data.id).toBe(a.id)
    const active = async () => (await db.query(`SELECT COUNT(*)::int AS n FROM conversation_members WHERE conversation_id = $1 AND left_at IS NULL`, [a.id])).rows[0].n
    expect(await active()).toBe(2)

    await member.post(`/api/communities/${slug}/join`).expect(201) // rời cộng đồng
    expect(await active()).toBe(1)
    await member.post(`/api/communities/${slug}/chat`).expect(403)
  })

  it('hỏi N7AI: chỉ thành viên; trả lời kèm nguồn được trích dẫn', async () => {
    const { slug, c, owner, member, out } = await setup()
    const id = await post(owner, c, 'Lịch thi giữa kỳ môn Giải tích là thứ Hai tuần sau')
    await owner.put(`/api/communities/${slug}/pins/${id}`).expect(200)
    await out.post(`/api/communities/${slug}/ask`).send({ question: 'Lịch thi giải tích?' }).expect(403)
    await member.post(`/api/communities/${slug}/ask`).send({ question: 'a' }).expect(400)

    const restore = stubProviders(app, reply('Thi giữa kỳ vào thứ Hai tuần sau [1].'))
    try {
      const res = (await member.post(`/api/communities/${slug}/ask`).send({ question: 'Lịch thi giữa kỳ giải tích khi nào?' }).expect(200)).body.data
      expect(res.answer).toContain('[1]')
      expect(res.sources).toEqual([expect.objectContaining({ index: 1, type: 'post', id })])
    } finally {
      restore()
    }
  })
})
