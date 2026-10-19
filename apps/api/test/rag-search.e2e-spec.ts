import { createServer, type Server } from 'http'
import type { AddressInfo } from 'net'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { AiRetrieval, toTsQuery } from '../src/modules/ai/ai.retrieval'
import * as docText from '../src/modules/ai/doc-text'
import { EMBED_DIM } from '../src/modules/ai/rag/embedding.service'
import { OcrService } from '../src/modules/ai/rag/ocr.service'
import { RagIndexProcessor } from '../src/modules/ai/rag/rag-index.processor'
import { RagIndexService } from '../src/modules/ai/rag/rag-index.service'
import { fuseRankings, RagSearchService } from '../src/modules/ai/rag/rag-search.service'
import { cleanPages, isGarbled } from '../src/modules/ai/rag/text-cleaner'
import { chunkText, headingLevel, MAX_CHUNKS } from '../src/modules/ai/rag/text-chunker'
import { createTestApp, createUser } from './helpers'

// RAG (docs/core/17-rag-hybrid-search.md): server embedding giả (nhóm từ đồng nghĩa ⇒ cùng chiều) + R2 giả phục vụ tệp
const CONCEPTS = [
  ['dao ham', 'toc do bien thien', 'derivative', 'rate of change'],
  ['dijkstra', 'duong di ngan nhat', 'shortest path'],
  ['khoa ngoai', 'foreign key', 'rang buoc lien ket giua cac bang']
]
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase()

function fakeEmbedding(text: string): number[] {
  const v = new Array(EMBED_DIM).fill(0)
  const t = plain(text)
  CONCEPTS.forEach((words, i) => words.some((w) => t.includes(w)) && (v[i] = 1))
  // Nhiễu nhỏ theo từ ⇒ không có vector 0, văn bản không liên quan có cosine thấp
  for (const w of new Set(t.split(/\W+/).filter(Boolean))) v[100 + ([...w].reduce((h, c) => h * 31 + c.charCodeAt(0), 7) % (EMBED_DIM - 100))] += 0.05
  return v
}

const FILES: Record<string, string> = {
  '/documents/u/calculus.txt': [
    'Chương 3. Ứng dụng của đạo hàm trong khảo sát hàm số.',
    'Đạo hàm của hàm số tại một điểm cho biết tốc độ biến thiên tức thời của hàm tại điểm đó. Nếu f′(x) > 0 trên khoảng (a, b) thì hàm đồng biến.',
    'Bài tập: tìm cực trị của f(x) = x³ − 3x + 1 trên đoạn [−2, 2].'
  ].join('\n\n'),
  '/documents/u/calculus-2.txt': 'Giải tích 1, bản sao chép riêng.\n\nĐạo hàm của hàm số tại một điểm cho biết tốc độ biến thiên tức thời của hàm tại điểm đó.',
  '/documents/u/sql.txt': 'Khóa ngoại (foreign key) đảm bảo toàn vẹn tham chiếu: giá trị ở bảng con phải tồn tại ở bảng cha.',
  // Mỗi câu (đề / lời giải) cách nhau bằng đoạn đệm dài ⇒ nằm ở các đoạn khác nhau
  '/documents/u/exam.txt': [
    'PHẦN ĐỀ BÀI\nCâu 1 – Đồ thị (3 điểm)\nCho đồ thị trọng số không âm, trình bày thuật toán Dijkstra tìm đường đi ngắn nhất từ đỉnh nguồn.',
    'Câu 2 – Sắp xếp (2 điểm)\nSo sánh sắp xếp nhanh và sắp xếp trộn về độ phức tạp trung bình.',
    'PHẦN LỜI GIẢI\nLời giải Câu 1 – Đồ thị\nKhởi tạo khoảng cách nguồn bằng 0, dùng hàng đợi ưu tiên lấy đỉnh gần nhất rồi nới lỏng các cạnh kề. ĐÁP_ÁN_CÂU_1',
    'Lời giải Câu 2 – Sắp xếp\nCả hai đều O(n log n) trung bình. ĐÁP_ÁN_CÂU_2'
  ].join('\n\n' + 'Nội dung đệm để mỗi câu nằm ở đoạn riêng. '.repeat(25) + '\n\n'),
  '/documents/u/poison.txt': 'Đoạn này chứa POISON khiến server embedding báo lỗi.'
}
const OCR_TEXT = 'Đạo hàm riêng theo biến x của hàm hai biến được tính khi giữ y cố định (chữ đọc bằng OCR).'

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
          // Input hỏng ⇒ server lỗi cả lô (như Ollama khi 1 mục lỗi)
          if (input.some((t) => t.includes('POISON'))) return res.writeHead(500).end()
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ data: input.map((t, index) => ({ index, embedding: fakeEmbedding(t) })) }))
        })
        return
      }
      if (req.method === 'POST' && req.url === '/v1/chat/completions') {
        req.resume()
        req.on('end', () => {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ choices: [{ message: { content: OCR_TEXT } }] }))
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
    process.env.OCR_BASE_URL = `${base}/v1`
    process.env.OCR_MODEL = 'fake-vision'
    ;({ app, db } = await createTestApp())
    // Worker nền (lịch quét) chạy song song với sweep() gọi tay ⇒ tắt để kết quả xác định
    await app.get(RagIndexProcessor).worker.close()
  })
  afterAll(async () => {
    await app.close()
    await new Promise((resolve) => server.close(resolve))
    delete process.env.EMBED_BASE_URL
    delete process.env.EMBED_MODEL
    delete process.env.R2_PUBLIC_URL
    delete process.env.OCR_BASE_URL
    delete process.env.OCR_MODEL
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
    expect(
      fuseRankings([
        ['a', 'b'],
        ['b', 'c']
      ]).get('b')
    ).toBeGreaterThan(
      fuseRankings([
        ['a', 'b'],
        ['b', 'c']
      ]).get('a')!
    )
  })

  it('Worker: trích tệp R2 → đoạn + embedding; URL ngoài R2 không tải; bài viết có embedding và tính lại khi sửa', async () => {
    const owner = await createUser(db)
    const calculus = await doc(owner.id, 'Giải tích 1 — chương 3', '/documents/u/calculus.txt')
    const outside = await doc(owner.id, 'Tệp ngoài', 'https://evil.example/secret.txt')
    const post = (
      await db.query(
        `INSERT INTO posts (author_id, title, content, visibility) VALUES ($1, 'Thuật toán Dijkstra', 'Dijkstra dùng hàng đợi ưu tiên', 'public') RETURNING id`,
        [owner.id]
      )
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
    const calculus = await doc(owner.id, 'Giải tích 1 — chương 3 (bản 2)', '/documents/u/calculus-2.txt')
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
        await db.query(
          `INSERT INTO posts (author_id, title, content, visibility) VALUES ($1, $2, 'Cài đặt tìm đường đi ngắn nhất bằng heap', $3) RETURNING id`,
          [author.id, title, visibility]
        )
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

  it('Hybrid lọc nhiễu full-text: khớp chữ nhưng xa nghĩa (cosine thấp) bị loại; chế độ full-text thuần vẫn ra', async () => {
    const author = await createUser(db)
    const noise = (
      await db.query(
        `INSERT INTO posts (author_id, title, content, visibility) VALUES ($1, 'Lịch thi học kỳ', 'Lịch thi học kỳ này dời sang tuần sau', 'public') RETURNING id`,
        [author.id]
      )
    ).rows[0].id
    await app.get(RagIndexService).sweep()

    const rag = app.get(RagSearchService)
    const question = 'lịch học kỳ derivative'
    const query = await rag.prepare(question, toTsQuery(question))
    expect((await rag.posts(query, author.id, { limit: 10, bodyChars: 200, mode: 'fulltext' })).map((s) => s.id)).toContain(noise)
    expect((await rag.posts(query, author.id, { limit: 10, bodyChars: 200 })).map((s) => s.id)).not.toContain(noise)
  })

  it('Làm sạch: NFC, bỏ header/footer lặp + số trang, nối dòng ngắt giữa câu; nhận diện chữ rác TCVN3', () => {
    const page = (n: number, body: string) => `Trường Đại học Phenikaa – Giáo trình\n${body}\nTrang ${n}`
    const text = cleanPages([
      page(1, 'Đạo hàm là giới hạn của tỉ số\ngiữa số gia hàm số và số gia đối số.'),
      page(2, 'Tích phân xác định'.normalize('NFD')),
      page(3, 'Chuỗi số dương.')
    ])
    expect(text).not.toContain('Trường Đại học Phenikaa')
    expect(text).not.toMatch(/Trang \d/)
    expect(text).toContain('giới hạn của tỉ số giữa số gia')
    expect(text).toContain('Tích phân xác định')
    expect(text).toBe(text.normalize('NFC'))
    expect(isGarbled('Tr\u00adêng §¹i häc Phenikaa – Khoa C\u00f4ng nghÖ th\u00f4ng tin, gi¸o tr×nh ®¹i sè tuyÕn tÝnh')).toBe(true)
    expect(isGarbled('Trường Đại học Phenikaa – Khoa Công nghệ thông tin, giáo trình đại số tuyến tính')).toBe(false)
  })

  it('Cắt đoạn mang đường dẫn tiêu đề mục', () => {
    expect(headingLevel('3. Đồ thị')).toBe(2)
    expect(headingLevel('3.2 Thuật toán Dijkstra')).toBe(3)
    expect(headingLevel('Lời giải Câu 1 – Đồ thị')).toBe(4)
    expect(headingLevel('Đây là một câu văn bình thường kết thúc bằng dấu chấm.')).toBeNull()
    const chunks = chunkText(['CHƯƠNG 3 ĐỒ THỊ', '3.2 Thuật toán Dijkstra', 'Dijkstra dùng hàng đợi ưu tiên.'].join('\n'))
    // Đoạn ngắn chỉ có tiêu đề cha ⇒ nhận tiêu đề cụ thể hơn của nội dung bên dưới
    expect(chunks[0].heading).toBe('CHƯƠNG 3 ĐỒ THỊ › 3.2 Thuật toán Dijkstra')
    const later = chunkText(['CHƯƠNG 3 ĐỒ THỊ', 'x '.repeat(700), '3.2 Thuật toán Dijkstra', 'Dijkstra dùng hàng đợi ưu tiên.'].join('\n\n'))
    expect(later.at(-1)?.heading).toBe('CHƯƠNG 3 ĐỒ THỊ › 3.2 Thuật toán Dijkstra')
  })

  // pdfjs không chạy trong VM của Jest (dynamic import) ⇒ giả lập lớp chữ từng trang + ảnh trang; gọi model vision thật qua server giả
  it('OCR: trang scan / chữ rác ⇒ đọc lại bằng model vision; trang có chữ giữ nguyên', async () => {
    const owner = await createUser(db)
    const scan = await doc(owner.id, 'Bản scan giải tích', '/documents/u/calculus.txt', { mime: 'application/pdf' })
    const textLayer = jest.spyOn(docText, 'pdfPageTexts').mockResolvedValue({
      pages: [
        '',
        'Tích phân xác định là diện tích hình phẳng dưới đồ thị hàm số trên đoạn [a, b].',
        'Tr\u00adêng §¹i häc Phenikaa gi¸o tr×nh ®¹i sè tuyÕn tÝnh vµ h×nh häc'
      ],
      total: 3
    })
    const ocr = app.get(OcrService)
    const pages = jest.spyOn(ocr, 'pdfPages').mockImplementation(async (_buf, list) => new Map(list.map((n) => [n, `${OCR_TEXT} Trang ${n}.`])))
    let calls: unknown[][]
    try {
      await app.get(RagIndexService).sweep()
      calls = pages.mock.calls.map((c) => [...c])
    } finally {
      textLayer.mockRestore()
      pages.mockRestore()
    }
    expect(calls).toEqual([[expect.any(Buffer), [1, 3]]])
    expect(await status(scan)).toBe('indexed')
    const text = (await db.query(`SELECT string_agg(content_text, ' ') AS t FROM document_chunks WHERE document_id = $1`, [scan])).rows[0].t
    expect(text).toContain('chữ đọc bằng OCR')
    expect(text).toContain('Tích phân xác định')
    expect(text).not.toContain('§¹i')

    // Gọi model vision: ảnh base64 trong message, model OCR riêng
    expect(await (ocr as unknown as { image: (b: string, m: string) => Promise<string> }).image('AAAA', 'image/png')).toBe(OCR_TEXT)
    expect(requests).toContain('POST /v1/chat/completions')
  })

  it('Lô embedding có 1 input hỏng: chỉ mục đó bị đánh dấu, phần còn lại + bài viết vẫn có embedding', async () => {
    const owner = await createUser(db)
    const poison = await doc(owner.id, 'Tài liệu hỏng', '/documents/u/poison.txt')
    const good = await doc(owner.id, 'Tài liệu tốt về khóa ngoại', '/documents/u/sql.txt')
    const post = (
      await db.query(
        `INSERT INTO posts (author_id, title, content, visibility) VALUES ($1, 'Sau lô hỏng', 'Bài viết vẫn phải có embedding', 'public') RETURNING id`,
        [owner.id]
      )
    ).rows[0].id
    await app.get(RagIndexService).sweep()
    const model = async (id: string) =>
      (await db.query(`SELECT embedding_model FROM document_chunks WHERE document_id = $1`, [id])).rows.map((r) => r.embedding_model)
    expect(await model(poison)).toEqual(['error:fake-embed'])
    expect(await model(good)).toEqual(['fake-embed'])
    expect((await db.query(`SELECT model FROM post_embeddings WHERE post_id = $1`, [post])).rows[0]?.model).toBe('fake-embed')
    // Lượt sau không gửi lại mục hỏng (input chưa đổi)
    const before = requests.length
    await app.get(RagIndexService).sweep()
    expect(requests.slice(before).filter((r) => r === 'POST /v1/embeddings')).toHaveLength(0)
  })

  it('Đổi tiêu đề ⇒ embedding lại; nâng phiên bản pipeline ⇒ index lại; tệp trùng ⇒ chỉ 1 nguồn', async () => {
    const owner = await createUser(db)
    const a = await doc(owner.id, 'Khóa ngoại bản A', '/documents/u/sql.txt')
    const b = await doc(owner.id, 'Khóa ngoại bản B', '/documents/u/sql.txt')
    await app.get(RagIndexService).sweep()
    const hash = async () => (await db.query(`SELECT source_hash FROM document_chunks WHERE document_id = $1`, [a])).rows[0].source_hash
    const before = await hash()
    await db.query(`UPDATE documents SET title = 'Khóa ngoại bản A (sửa tên)' WHERE id = $1`, [a])
    await app.get(RagIndexService).sweep()
    expect(await hash()).not.toBe(before)

    await db.query(`UPDATE documents SET index_version = 1 WHERE id = $1`, [a])
    await app.get(RagIndexService).sweep()
    expect((await db.query(`SELECT index_version FROM documents WHERE id = $1`, [a])).rows[0].index_version).toBeGreaterThan(1)

    const rag = app.get(RagSearchService)
    const question = 'foreign key toàn vẹn tham chiếu'
    const ids = (await rag.documents(await rag.prepare(question, toTsQuery(question)), owner.id, { limit: 10, bodyChars: 500 })).map((s) => s.id)
    expect(ids.filter((id) => id === a || id === b)).toHaveLength(1)
  })

  it('Đề thi: đoạn đề "Câu 1" kéo theo đoạn "Lời giải Câu 1"', async () => {
    const owner = await createUser(db)
    const exam = (
      await db.query(
        `INSERT INTO documents (owner_id, title, file_url, mime_type, doc_type) VALUES ($1, 'Đề ôn tập CTDL', $2, 'text/plain', 'final_exam') RETURNING id`,
        [owner.id, `${base}/documents/u/exam.txt`]
      )
    ).rows[0].id
    await app.get(RagIndexService).sweep()
    const headings = (await db.query(`SELECT heading FROM document_chunks WHERE document_id = $1 ORDER BY chunk_index`, [exam])).rows.map((r) => r.heading)
    expect(headings.some((h) => /Lời giải Câu 1/.test(h ?? ''))).toBe(true)

    const rag = app.get(RagSearchService)
    const question = 'shortest path trên đồ thị trọng số không âm'
    const hit = (await rag.documents(await rag.prepare(question, toTsQuery(question)), owner.id, { limit: 5, bodyChars: 3000 })).find((s) => s.id === exam)
    expect(hit?.body).toContain('ĐÁP_ÁN_CÂU_1')
    expect(hit?.body).not.toContain('ĐÁP_ÁN_CÂU_2')
  })
})
