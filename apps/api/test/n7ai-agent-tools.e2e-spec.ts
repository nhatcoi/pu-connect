import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { parseActionLines, safeAppHref, toActions } from '../src/modules/chat/n7ai/agent/ai-actions'
import { HistoryToolsService } from '../src/modules/chat/n7ai/agent/history-tools.service'
import { PucToolsService } from '../src/modules/chat/n7ai/agent/puc-tools.service'
import { StudyDigestService, studyDigestPrompt } from '../src/modules/chat/n7ai/agent/study-digest.service'
import { AiMemoriesService } from '../src/modules/chat/n7ai/ai-memories.service'
import { FollowUpSplitter, parseFollowUps } from '../src/modules/chat/n7ai/n7ai.followups'
import { learnerPrompt } from '../src/modules/chat/n7ai/n7ai.prompts'
import { createTestApp, createUser, loginAgent } from './helpers'

// N7AI agent (docs/core/16-n7ai-agent-tools.md): hội thoại cũ, tool PU Connector, nút dẫn đường, hồ sơ học, ghim bộ nhớ
describe('N7AI agent tools (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService
  let botId: string

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
    botId = (await db.query(`SELECT id FROM users WHERE username = 'n7ai' AND account_type = 'bot'`)).rows[0].id
  })
  afterAll(async () => {
    await app.close()
  })

  // Thread N7AI có sẵn tin (không gọi LLM)
  async function thread(userId: string, title: string, messages: [string, string][]) {
    const c = (await db.query(`INSERT INTO conversations (type, title, created_by) VALUES ('ai', $1, $2) RETURNING id`, [title, userId])).rows[0].id
    let last: string | null = null
    for (const [who, content] of messages) {
      last = (
        await db.query(`INSERT INTO messages (conversation_id, sender_id, kind, content) VALUES ($1, $2, $3, $4) RETURNING id`, [
          c,
          who === 'ai' ? botId : userId,
          who === 'ai' ? 'ai' : 'text',
          content
        ])
      ).rows[0].id
    }
    await db.query(`UPDATE conversations SET last_message_id = $2, last_message_at = NOW() WHERE id = $1`, [c, last])
    return c as string
  }

  it('Hội thoại của tôi: tìm theo nội dung (bỏ dấu), đọc lại; bỏ thread hiện tại & thread người khác', async () => {
    const user = await createUser(db)
    const old = await thread(user.id, 'Ôn giải tích', [
      ['user', 'Giải thích đạo hàm riêng giúp mình'],
      ['ai', 'Đạo hàm riêng là đạo hàm theo một biến, giữ các biến khác cố định.']
    ])
    const current = await thread(user.id, 'Hôm nay', [['user', 'đạo hàm riêng là gì']])
    const stranger = await createUser(db)
    await thread(stranger.id, 'Người khác', [['user', 'dao ham rieng']])

    const session = app.get(HistoryToolsService).open(user.id, current)
    const found = JSON.parse(await session.call('my_chats__search_threads', { query: 'dao ham rieng' })).data
    expect(found).toEqual([expect.objectContaining({ id: old, title: 'Ôn giải tích', snippet: expect.stringContaining('Đạo hàm riêng') })])

    const read = JSON.parse(await session.call('my_chats__get_thread', { thread_id: old })).data
    expect(read.messages.map((m: { from: string }) => m.from)).toEqual(['user', 'N7AI'])
    expect(JSON.parse(await session.call('my_chats__get_thread', { thread_id: current })).data.error).toBeDefined()

    const other = app.get(HistoryToolsService).open(stranger.id, current)
    expect(JSON.parse(await other.call('my_chats__get_thread', { thread_id: old })).data.error).toBe('Không tìm thấy hội thoại')
    expect(session.describe('my_chats__search_threads', { query: 'dao ham' })).toEqual({ provider: 'my_chats', label: 'Tìm trong hội thoại cũ', detail: 'dao ham' })
  })

  it('PU Connector: tìm nhóm học / cộng đồng, hướng dẫn app; chỉ nhóm còn nhận người mới thành nút tham gia', async () => {
    const user = await createUser(db)
    const leader = await createUser(db)
    const code = `AG${Date.now() % 100000}`
    await db.query(`INSERT INTO courses (code, name, credits) VALUES ($1, 'Giải tích agent', 3)`, [code])
    const group = (
      await db.query(
        `INSERT INTO study_groups (leader_id, course_code, course_name, name, topic, description) VALUES ($1, $2, 'Giải tích agent', 'Nhóm ôn Giải tích agent', 'Ôn thi', 'Ôn cuối kỳ') RETURNING id`,
        [leader.id, code]
      )
    ).rows[0].id
    await db.query(`INSERT INTO study_group_members (group_id, user_id, role) VALUES ($1, $2, 'leader')`, [group, leader.id])
    const slug = `agent-${Date.now()}`
    await db.query(`INSERT INTO communities (slug, name, description) VALUES ($1, 'CLB Giải tích agent', 'Cộng đồng ôn toán')`, [slug])

    const session = app.get(PucToolsService).open(user.id)
    const groups = JSON.parse(await session.call('puc__search', { query: 'Giải tích agent', type: 'groups' })).data.groups
    expect(groups).toEqual([expect.objectContaining({ id: group, status: 'recruiting', href: `/courses/${code}` })])
    const communities = JSON.parse(await session.call('puc__search', { query: 'giai tich agent', type: 'communities' })).data.communities
    expect(communities).toEqual([expect.objectContaining({ name: 'CLB Giải tích agent', href: `/c/${slug}` })])
    const help = JSON.parse(await session.call('puc__app_help', { topic: 'ôn flashcard' })).data
    expect(help[0]).toMatchObject({ feature: 'Công cụ học tập', href: '/tools' })

    const tools = app.get(PucToolsService)
    expect([...(await tools.joinableGroups(user.id, [group])).keys()]).toEqual([group])
    expect((await tools.joinableGroups(leader.id, [group])).size).toBe(0) // đã là thành viên
  })

  it('Nút: chỉ đường dẫn trong app, nhóm phải hợp lệ; không lẫn vào câu hỏi gợi ý', () => {
    expect(safeAppHref('/courses/IT101')).toBe('/courses/IT101')
    expect(safeAppHref('/search?q=giải tích&type=documents&x=1')).toBe('/search?q=gi%E1%BA%A3i+t%C3%ADch&type=documents')
    expect(safeAppHref('https://evil.com')).toBeNull()
    expect(safeAppHref('//evil.com/x')).toBeNull()
    expect(safeAppHref('/post/not-a-uuid')).toBeNull()
    expect(safeAppHref('/n7ai/settings/profile')).toBe('/n7ai/settings/profile')

    const id = '0b3c8e9a-1d2f-4a5b-8c7d-6e5f4a3b2c1d'
    const tail = `\n[nguồn] 1\n[mở] Học phần IT101 | /courses/IT101\n[mở] Lừa | javascript:alert(1)\n[tham gia] ${id}\n- Câu hỏi tiếp theo về IT101?`
    const drafts = parseActionLines(tail)
    expect(drafts).toEqual([
      { kind: 'link', label: 'Học phần IT101', href: '/courses/IT101' },
      { kind: 'join_group', id }
    ])
    expect(parseFollowUps(tail)).toEqual(['Câu hỏi tiếp theo về IT101?'])
    expect(toActions(drafts, new Map())).toEqual([{ kind: 'link', label: 'Học phần IT101', href: '/courses/IT101' }])
    expect(toActions(drafts, new Map([[id, { id, name: 'A', courseCode: 'IT101' }]]))[1]).toEqual({
      kind: 'join_group',
      id,
      label: 'Tham gia nhóm A',
      href: '/courses/IT101'
    })

    const splitter = new FollowUpSplitter()
    splitter.push('Trả lời.\n<<<FOLLOWUPS>>>\n[mở] Công cụ | /tools\n- Hỏi tiếp?')
    expect(splitter.finish().actions).toEqual([{ kind: 'link', label: 'Công cụ', href: '/tools' }])
  })

  it('Hồ sơ học: lưu / xóa từng trường, vào system prompt; mục nhớ ghim luôn được nhớ', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const saved = (await agent.patch('/api/ai/settings').send({ profile: { goal: 'IELTS 6.5', style: 'Ngắn gọn' } }).expect(200)).body.data
    expect(saved.profile).toEqual({ goal: 'IELTS 6.5', about: null, style: 'Ngắn gọn' })
    const cleared = (await agent.patch('/api/ai/settings').send({ profile: { style: '' } }).expect(200)).body.data
    expect(cleared.profile).toEqual({ goal: 'IELTS 6.5', about: null, style: null })
    await agent.patch('/api/ai/settings').send({ profile: { goal: 'x'.repeat(301) } }).expect(400)

    expect(learnerPrompt({ name: 'An', school: null, faculty: null, major: 'CNTT', className: null, academicYear: 'K17', goal: 'IELTS 6.5', about: null, style: null })).toContain(
      '- Mục tiêu học: IELTS 6.5'
    )

    const memories = app.get(AiMemoriesService)
    const pinned = (await agent.post('/api/ai/memories').send({ content: 'Thi cuối kỳ Giải tích ngày 20/12' }).expect(201)).body.data
    for (let i = 0; i < 9; i++) await memories.create(user.id, `Sở thích số ${i} về âm nhạc`)
    expect(await memories.recall(user.id, 'âm nhạc')).not.toContain('Thi cuối kỳ Giải tích ngày 20/12')
    expect((await agent.patch(`/api/ai/memories/${pinned.id}/pin`).send({ pinned: true }).expect(200)).body.data.pinned).toBe(true)
    expect((await memories.recall(user.id, 'âm nhạc'))[0]).toBe('Thi cuối kỳ Giải tích ngày 20/12')
    expect((await agent.get('/api/ai/memories').expect(200)).body.data[0].id).toBe(pinned.id)
  })

  it('Tiến độ học tóm tắt: bộ đã ôn gần đây, thẻ hay quên, đưa vào system prompt', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    expect(await app.get(StudyDigestService).recent(user.id)).toEqual([]) // chưa học gì ⇒ không có khối
    const set = (
      await agent
        .post('/api/tools/sets')
        .send({ kind: 'flashcards', title: 'Vũ trụ', items: [{ content: { front: 'Wormhole', back: 'Lỗ sâu' } }, { content: { front: 'Galaxy', back: 'Thiên hà' } }] })
        .expect(201)
    ).body.data
    await agent.post(`/api/tools/sets/${set.id}/review`).send({ itemId: set.items[0].id, grade: 'again' }).expect(201)

    const digest = await app.get(StudyDigestService).recent(user.id)
    expect(digest).toEqual([expect.objectContaining({ title: 'Vũ trụ', kind: 'flashcards', items: 2, learned: 0, weak: ['Wormhole'] })])
    expect(studyDigestPrompt(digest)).toContain('hay quên: Wormhole')
    expect(studyDigestPrompt([])).toBe('')
  })
})
