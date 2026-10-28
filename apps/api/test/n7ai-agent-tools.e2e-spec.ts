import type { NestExpressApplication } from '@nestjs/platform-express'
import type { AiStep } from '@pu/schemas'
import type { DatabaseService } from '../src/database/database.service'
import { AiRetrieval } from '../src/modules/ai/ai.retrieval'
import { McpAgentService } from '../src/modules/ai/mcp-agent.service'
import { AiProgress } from '../src/modules/chat/n7ai/agent/ai-progress'
import { parseActionLines, safeAppHref, toActions } from '../src/modules/chat/n7ai/agent/ai-actions'
import { HistoryToolsService } from '../src/modules/chat/n7ai/agent/history-tools.service'
import { PucToolsService } from '../src/modules/chat/n7ai/agent/puc-tools.service'
import { AiMemoriesService } from '../src/modules/chat/n7ai/ai-memories.service'
import { FollowUpSplitter, parseFollowUps } from '../src/modules/chat/n7ai/n7ai.followups'
import { learnerPrompt } from '../src/modules/chat/n7ai/n7ai.prompts'
import { StudyProgressMemoryService } from '../src/modules/study-tools/study-progress-memory.service'
import { createTestApp, createUser, loginAgent } from './helpers'

// N7AI agent (docs/core/16-n7ai-agent-tools.md): hội thoại cũ, tool PU Connect, nút dẫn đường, hồ sơ học, ghim bộ nhớ
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

  it('Hội thoại của tôi: khớp BẤT KỲ từ khóa, xếp theo số từ khớp (1 lần gọi là đủ, không cần thử lại ít từ hơn)', async () => {
    const user = await createUser(db)
    const both = await thread(user.id, 'Ý tưởng NCKH', [['user', 'Mình muốn làm nghiên cứu y tế và AI phân loại ảnh X-quang']])
    const one = await thread(user.id, 'Lịch ôn thi', [['user', 'Nhắc mình lịch thi y tế công cộng']])
    await thread(user.id, 'Nấu ăn', [['user', 'Công thức nấu phở']])
    const current = await thread(user.id, 'Hiện tại', [['user', 'tìm giúp']])

    const session = app.get(HistoryToolsService).open(user.id, current)
    // "NCKH y tế AI": không thread nào chứa đủ cả 3 từ trong CÙNG tin ⇒ kiểu "tất cả từ" sẽ trả rỗng
    const found = JSON.parse(await session.call('my_chats__search_threads', { query: 'NCKH y tế AI' })).data as { id: string }[]
    expect(found.map((t) => t.id)).toEqual([both, one]) // khớp nhiều từ hơn đứng trước; "Nấu ăn" không khớp
  })

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
    expect(session.describe('my_chats__search_threads', { query: 'dao ham' })).toEqual({
      provider: 'my_chats',
      label: 'Tìm trong hội thoại cũ',
      detail: 'dao ham'
    })
  })

  it('PU Connect: tìm nhóm học / cộng đồng, hướng dẫn app; chỉ nhóm còn nhận người mới thành nút tham gia', async () => {
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
    const saved = (
      await agent
        .patch('/api/ai/settings')
        .send({ profile: { goal: 'IELTS 6.5', style: 'Ngắn gọn' } })
        .expect(200)
    ).body.data
    expect(saved.profile).toEqual({ goal: 'IELTS 6.5', about: null, style: 'Ngắn gọn' })
    const cleared = (
      await agent
        .patch('/api/ai/settings')
        .send({ profile: { style: '' } })
        .expect(200)
    ).body.data
    expect(cleared.profile).toEqual({ goal: 'IELTS 6.5', about: null, style: null })
    await agent
      .patch('/api/ai/settings')
      .send({ profile: { goal: 'x'.repeat(301) } })
      .expect(400)

    expect(
      learnerPrompt({
        name: 'An',
        university: null,
        interestField: 'CNTT',
        goal: 'IELTS 6.5',
        about: null,
        style: null
      })
    ).toContain('- Mục tiêu học: IELTS 6.5')

    const memories = app.get(AiMemoriesService)
    const pinned = (await agent.post('/api/ai/memories').send({ content: 'Thi cuối kỳ Giải tích ngày 20/12' }).expect(201)).body.data
    for (let i = 0; i < 9; i++) await memories.create(user.id, `Sở thích số ${i} về âm nhạc`)
    expect(await memories.recall(user.id, 'âm nhạc')).not.toContain('Thi cuối kỳ Giải tích ngày 20/12')
    expect((await agent.patch(`/api/ai/memories/${pinned.id}/pin`).send({ pinned: true }).expect(200)).body.data.pinned).toBe(true)
    expect((await memories.recall(user.id, 'âm nhạc'))[0]).toBe('Thi cuối kỳ Giải tích ngày 20/12')
    expect((await agent.get('/api/ai/memories').expect(200)).body.data[0].id).toBe(pinned.id)
  })

  it('Bộ nhớ tự ghi tiến độ: 1 mục / bộ, ghi đè sau mỗi lần ôn / làm quiz; tắt ghi nhớ ⇒ không ghi', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const set = (
      await agent
        .post('/api/tools/sets')
        .send({
          kind: 'flashcards',
          title: 'Vũ trụ',
          items: [{ content: { front: 'Wormhole', back: 'Lỗ sâu' } }, { content: { front: 'Galaxy', back: 'Thiên hà' } }]
        })
        .expect(201)
    ).body.data
    const progress = app.get(StudyProgressMemoryService)
    await agent.post(`/api/tools/sets/${set.id}/review`).send({ itemId: set.items[0].id, grade: 'again' }).expect(201)
    await agent.post(`/api/tools/sets/${set.id}/review`).send({ itemId: set.items[1].id, grade: 'good' }).expect(201)
    await progress.write(user.id, set.id) // đợi chắc chắn (ghi nền sau mỗi lượt ôn)
    const rows = (await db.query(`SELECT content, source FROM ai_memories WHERE user_id = $1 AND study_set_id = $2`, [user.id, set.id])).rows
    expect(rows).toHaveLength(1) // 2 lượt ôn ⇒ vẫn 1 mục
    expect(rows[0].source).toBe('auto')
    expect(rows[0].content).toMatch(/^Đang ôn Flashcard "Vũ trụ" \(2 thẻ\): đã thuộc 0, đến hạn ôn 0, hay quên: Wormhole \(cập nhật \d{2}\/\d{2}\)$/)
    expect((await agent.get('/api/ai/memories').expect(200)).body.data.map((m: { content: string }) => m.content)).toContain(rows[0].content)

    const quiz = (
      await agent
        .post('/api/tools/sets')
        .send({ kind: 'quiz', title: 'Giải tích', items: [{ content: { q: '1+1?', options: ['1', '2'], answer: 1 } }] })
        .expect(201)
    ).body.data
    await agent.post(`/api/tools/sets/${quiz.id}/attempts`).send({ correct: 1, total: 1 }).expect(201)
    expect(await progress.write(user.id, quiz.id)).toMatch(/^Đã làm Quiz "Giải tích" \(1 câu\) 1 lần, điểm cao nhất 100%/)

    await agent.patch('/api/ai/settings').send({ memoryEnabled: false }).expect(200)
    expect(await progress.write(user.id, set.id)).toBeNull()
    await agent.delete(`/api/tools/sets/${set.id}`).expect(204)
    expect((await db.query(`SELECT 1 FROM ai_memories WHERE study_set_id = $1`, [set.id])).rows).toHaveLength(0) // xóa bộ ⇒ xóa mục
  })

  it('Tiến trình: bước chuẩn bị + tìm nguồn (số nguồn) + tool gộp thành 1 danh sách; "web" chỉ hiện khi đọc được trang', async () => {
    const emitted: AiStep[][] = []
    const progress = new AiProgress((steps) => emitted.push(steps))
    progress.note('refs', 'refs', 'Đọc mục bạn gắn kèm', '2 mục')
    progress.retrieval('library', 'running', 0, 'cách nhận biết data leakage khi tiền xử lý')
    progress.retrieval('web', 'running')
    progress.retrieval('web', 'done', 0)
    progress.retrieval('library', 'done', 4)
    progress.setTools([{ id: 't1', provider: 'puc', label: 'Tìm học phần', status: 'running' }])
    expect(progress.steps.map((s) => [s.provider, s.status, s.detail])).toEqual([
      ['refs', 'done', '2 mục'],
      ['library', 'done', '4 nguồn'],
      ['puc', 'running', undefined]
    ])
    expect(emitted.at(-1)).toEqual(progress.steps)

    // AiRetrieval báo từng connector (chạy ⇒ xong + số nguồn)
    const user = await createUser(db)
    const stages: string[] = []
    await app
      .get(AiRetrieval)
      .retrieve('đạo hàm riêng', user.id, { connectors: ['library', 'my_groups'], onStage: (c, state, n) => stages.push(`${c}:${state}:${n ?? ''}`) })
    expect(stages).toEqual(expect.arrayContaining(['library:running:', 'my_groups:running:', expect.stringMatching(/^library:done:\d+$/), 'my_groups:done:0']))
  })

  it('Gateway cắt luồng trước khi có chữ ("terminated") ⇒ thử lại 1 lần; đã có chữ thì không thử lại', async () => {
    let calls = 0
    const stream = (fail: boolean, text: string) => ({
      async *[Symbol.asyncIterator]() {
        if (text) yield { choices: [{ delta: { content: text } }] }
        if (fail) throw new TypeError('terminated')
        yield { choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1 } }
      }
    })
    const llm = (failFirst: boolean, partial: string) => ({
      model: 'fake',
      client: {},
      chat: () => Promise.resolve(stream(calls++ === 0 && failFirst, calls === 1 ? partial : 'Trả lời'))
    })
    const mcp = { open: async () => ({ tools: [], instructions: [], describe: () => null, call: async () => '{}', close: async () => undefined, errors: [] }) }
    const run = (failFirst: boolean, partial = '') => {
      calls = 0
      const out: string[] = []
      const agent = new McpAgentService(llm(failFirst, partial) as never, mcp as never)
      return agent.stream([{ role: 'user', content: 'hi' }], 'u', [], (t) => out.push(t)).then((r) => ({ ...r, out: out.join(''), calls }))
    }
    const retried = await run(true)
    expect(retried.calls).toBe(2)
    expect(retried.out).toBe('Trả lời')
    await expect(run(true, 'Đã có chữ')).rejects.toThrow('terminated')
  })
})
