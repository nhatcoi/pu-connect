import { createServer, type Server } from 'http'
import type { AddressInfo } from 'net'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { AiRetrieval, toTsQuery } from '../src/modules/ai/ai.retrieval'
import { EMBED_DIM } from '../src/modules/ai/rag/embedding.service'
import { RagIndexService } from '../src/modules/ai/rag/rag-index.service'
import { fuseRankings, RagSearchService } from '../src/modules/ai/rag/rag-search.service'
import { chunkText, MAX_CHUNKS } from '../src/modules/ai/rag/text-chunker'
import { createTestApp, createUser } from './helpers'

// RAG (docs/core/17-rag-hybrid-search.md): server embedding giả (nhóm từ đồng nghĩa ⇒ cùng chiều) + R2 giả phục vụ tệp
const CONCEPTS = [
  ['dao ham', 'toc do bien thien', 'derivative', 'rate of change'],
  ['dijkstra', 'duong di ngan nhat', 'shortest path'],
  ['khoa ngoai', 'foreign key', 'rang buoc lien ket giua cac bang']
]
const plain = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()

function fakeEmbedding(text: string): number[] {
  const v = new Array(EMBED_DIM).fill(0)
  const t = plain(text)
  CONCEPTS.forEach((words, i) => words.some((w) => t.includes(w)) && (v[i] = 1))
  // Nhiễu nhỏ theo từ ⇒ không có vector 0, văn bản không liên quan có cosine thấp
  for (const w of t.split(/\W+/).filter(Boolean)) v[100 + ([...w].reduce((h, c) => h * 31 + c.charCodeAt(0), 7) % (EMBED_DIM - 100))] += 0.05
  return v
}

const FILES: Record<string, string> = {
  '/documents/u/calculus.txt': [
    'Chương 3. Ứng dụng của đạo hàm trong khảo sát hàm số.',
    'Đạo hàm của hàm số tại một điểm cho biết tốc độ biến thiên tức thời của hàm tại điểm đó. Nếu f′(x) > 0 trên khoảng (a, b) thì hàm đồng biến.',
    'Bài tập: tìm cực trị của f(x) = x³ − 3x + 1 trên đoạn [−2, 2].'
  ].join('\n\n'),
  '/documents/u/sql.txt': 'Khóa ngoại (foreign key) đảm bảo toàn vẹn tham chiếu: giá trị ở bảng con phải tồn tại ở bảng cha.'
}

describe('RAG: index tài liệu + tìm kết hợp full-text/vector (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService
  let server: Server
  let base: string
  const requests: string[] = []

  beforeAll(async () => {
    server = createServer((req, res) => {
      requests.push(`${req.method} ${req.url}`)
      if (req.method === 'POST' && req.url === '/v1/embeddings') {
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          const { input } = JSON.parse(body) as { input: string[] }
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ data: input.map((t, index) => ({ index, embedding: fakeEmbedding(t) })) }))
        })
        return
      }
      const file = FILES[req.url ?? '']
      if (!file) return res.writeHead(404).end()
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end(file)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    process.env.EMBED_BASE_URL = `${base}/v1`
    process.env.EMBED_MODEL = 'fake-embed'
    process.env.R2_PUBLIC_URL = base
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
    await new Promise((resolve) => server.close(resolve))
    delete process.env.EMBED_BASE_URL
    delete process.env.EMBED_MODEL
    delete process.env.R2_PUBLIC_URL
  })

  async function doc(ownerId: string, title: string, path: string, opts: { visibility?: string; mime?: string } = {}) {
    return (
      await db.query(
        `INSERT INTO documents (owner_id, title, description, file_url, mime_type, visibility) VALUES ($1, $2, 'Tài liệu ôn tập', $3, $4, $5) RETURNING id`,
        [ownerId, title, path.startsWith('http') ? path : `${base}${path}`, opts.mime ?? 'text/plain', opts.visibility ?? 'public']
      )
    ).rows[0].id as string
  }

  const status = async (id: string) => (await db.query(`SELECT index_status FROM documents WHERE id = $1`, [id])).rows[0].index_status

  it('Cắt đoạn: giữ thứ tự, đoạn có phần nối với đoạn trước, không vượt giới hạn', () => {
    const text = Array.from({ length: 40 }, (_, i) => `Đoạn ${i}: ${'nội dung học tập '.repeat(12)}`).join('\n\n')
    const chunks = chunkText(text)
    expect(chunks.length).toBeGreaterThan(5)
    expect(chunks.every((c) => c.text.length <= 1800)).toBe(true)
    expect(chunks[1].text).toContain(chunks[0].text.slice(-50))
    expect(chunkText('x '.repeat(400_000)).length).toBeLessThanOrEqual(MAX_CHUNKS)
    expect(fuseRankings([['a', 'b'], ['b', 'c']]).get('b')).toBeGreaterThan(fuseRankings([['a', 'b'], ['b', 'c']]).get('a')!)
  })

  it('Worker: trích tệp R2 → đoạn + embedding; URL ngoài R2 không tải; bài viết có embedding và tính lại khi sửa', async () => {
    const owner = await createUser(db)
    const calculus = await doc(owner.id, 'Giải tích 1 — chương 3', '/documents/u/calculus.txt')
    const outside = await doc(owner.id, 'Tệp ngoài', 'https://evil.example/secret.txt')
    const post = (
      await db.query(`INSERT INTO posts (author_id, title, content, visibility) VALUES ($1, 'Thuật toán Dijkstra', 'Dijkstra dùng hàng đợi ưu tiên', 'public') RETURNING id`, [owner.id])
    ).rows[0].id

    await app.get(RagIndexService).sweep()
    expect(await status(calculus)).toBe('indexed')
    expect(await status(outside)).toBe('unsupported')
    expect(requests.some((r) => r.includes('evil'))).toBe(false)
    const chunks = (await db.query(`SELECT embedding IS NOT NULL AS embedded, embedding_model FROM document_chunks WHERE document_id = $1`, [calculus])).rows
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks.every((c) => c.embedded && c.embedding_model === 'fake-embed')).toBe(true)

    const hash = async () => (await db.query(`SELECT source_hash FROM post_embeddings WHERE post_id = $1`, [post])).rows[0]?.source_hash
    const before = await hash()
    expect(before).toBeDefined()
    await db.query(`UPDATE posts SET content = 'Dijkstra tìm đường đi ngắn nhất, đã sửa' WHERE id = $1`, [post])
    await app.get(RagIndexService).sweep()
    expect(await hash()).not.toBe(before)
  })

  it('Tìm kết hợp: câu hỏi khác chữ (vector) vẫn ra đúng đoạn tài liệu; full-text thuần không ra', async () => {
    const owner = await createUser(db)
    const asker = await createUser(db)
    const calculus = await doc(owner.id, 'Giải tích 1 — chương 3 (bản 2)', '/documents/u/calculus.txt')
    await app.get(RagIndexService).sweep()

    const rag = app.get(RagSearchService)
    const question = 'derivative rate of change là gì'
    const query = await rag.prepare(question, toTsQuery(question))
    expect(query.vector).not.toBeNull()

    const fulltext = await rag.documents(query, asker.id, { limit: 5, bodyChars: 1500, mode: 'fulltext' })
    expect(fulltext.map((s) => s.id)).not.toContain(calculus)

    const hybrid = await rag.documents(query, asker.id, { limit: 5, bodyChars: 1500 })
    const hit = hybrid.find((s) => s.id === calculus)
    expect(hit?.body).toContain('tốc độ biến thiên tức thời')

    // Qua AiRetrieval (connector Thư viện PU) như N7AI dùng
    const { sources } = await app.get(AiRetrieval).retrieve(question, asker.id, { connectors: ['library'] })
    expect(sources.some((s) => s.type === 'document' && s.id === calculus)).toBe(true)
  })

  it('Quyền xem: tài liệu riêng tư của người khác không lộ; "Tài liệu của tôi" chỉ tài liệu của mình', async () => {
    const owner = await createUser(db)
    const stranger = await createUser(db)
    const secret = await doc(owner.id, 'Ghi chú riêng CSDL', '/documents/u/sql.txt', { visibility: 'private' })
    await app.get(RagIndexService).sweep()
    expect(await status(secret)).toBe('indexed')

    const rag = app.get(RagSearchService)
    const question = 'ràng buộc liên kết giữa các bảng'
    const query = await rag.prepare(question, toTsQuery(question))
    expect((await rag.documents(query, stranger.id, { limit: 10, bodyChars: 500 })).map((s) => s.id)).not.toContain(secret)
    expect((await rag.documents(query, owner.id, { limit: 10, bodyChars: 500 })).map((s) => s.id)).toContain(secret)
    expect((await rag.documents(query, stranger.id, { limit: 10, bodyChars: 500, ownerOnly: true })).map((s) => s.id)).not.toContain(secret)
  })

  it('Bài viết: hỏi tiếng Anh ra bài tiếng Việt cùng ý; bài riêng tư / bị ẩn không lộ', async () => {
    const author = await createUser(db)
    const asker = await createUser(db)
    const insert = async (title: string, visibility: string) =>
      (
        await db.query(`INSERT INTO posts (author_id, title, content, visibility) VALUES ($1, $2, 'Cài đặt tìm đường đi ngắn nhất bằng heap', $3) RETURNING id`, [
          author.id,
          title,
          visibility
        ])
      ).rows[0].id as string
    const open = await insert('Hỏi về Dijkstra', 'public')
    const hidden = await insert('Dijkstra bản bị ẩn', 'public')
    const mine = await insert('Dijkstra riêng tư', 'private')
    await db.query(`UPDATE posts SET hidden_at = NOW() WHERE id = $1`, [hidden])
    await app.get(RagIndexService).sweep()

    const rag = app.get(RagSearchService)
    const question = 'shortest path algorithm'
    const ids = (await rag.posts(await rag.prepare(question, toTsQuery(question)), asker.id, { limit: 10, bodyChars: 500 })).map((s) => s.id)
    expect(ids).toContain(open)
    expect(ids).not.toContain(hidden)
    expect(ids).not.toContain(mine)
  })
})
