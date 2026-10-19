// Đánh giá RAG tự động trên dữ liệu thật: sinh câu hỏi từ bài viết / tài liệu đã index, đo tìm lại đúng nguồn
// theo 3 chế độ (fulltext | vector | hybrid) — hit@1/3/5, MRR; thêm câu hỏi lạc đề để đo kết quả nhiễu
// Chạy (sau build): node dist/apps/api/src/modules/ai/rag/rag-eval.cli.js --env /var/www/pu-connector/.env [--set set.json] [--out report.json] [--posts 60]
// Bộ câu hỏi lưu vào --set (lần sau dùng lại ⇒ so sánh được giữa các lần đổi model / ngưỡng)
import * as fs from 'node:fs'
import { ConfigService } from '@nestjs/config'
import { DatabaseService } from '../../../database/database.service'
import { toTsQuery } from '../ai.retrieval'
import { EmbeddingService } from './embedding.service'
import { MIN_SIMILARITY, RagSearchService, type RagMode } from './rag-search.service'

type Kind = 'post' | 'document'
type Style = 'paraphrase' | 'keyword'
type EvalCase = { kind: Kind; id: string; title: string; style: Style; question: string }
type EvalSet = { createdAt: string; cases: EvalCase[] }

const MODES: RagMode[] = ['fulltext', 'vector', 'hybrid']
const K = 5
// Câu hỏi không liên quan nội dung học trên PU ⇒ lý tưởng không trả nguồn nào
const OFF_TOPIC = [
  'cách nấu phở bò ngon tại nhà',
  'giá vé máy bay Hà Nội đi Đà Nẵng tháng này',
  'kết quả trận bóng đá tối qua',
  'mẹo chăm sóc cây xương rồng',
  'review phim hoạt hình mới ra rạp',
  'cách thay lốp xe đạp bị thủng'
]

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : fallback
}

// Gọi model sinh câu hỏi (model riêng cho eval, không dùng AI_MODEL đang phục vụ người dùng); 429 ⇒ chờ rồi thử lại
async function llmJson(prompt: string): Promise<Record<string, string>> {
  const base = (process.env.AI_BASE_URL ?? '').replace(/\/+$/, '').replace(/(\/v1)?$/, '/v1')
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.AI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.RAG_EVAL_MODEL || 'gemini-3.7-flash-medium', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(120_000)
    })
    if (res.status === 429 && attempt < 4) {
      await new Promise((r) => setTimeout(r, 10_000 * 2 ** attempt))
      continue
    }
    const text: string = (await res.json())?.choices?.[0]?.message?.content ?? ''
    const json = /\{[\s\S]*\}/.exec(text)?.[0]
    if (!json) throw new Error(`LLM không trả JSON (HTTP ${res.status})`)
    return JSON.parse(json)
  }
}

const QUESTION_PROMPT = (kind: Kind, title: string, body: string) => `Đây là một ${kind === 'post' ? 'bài viết hỏi đáp' : 'tài liệu học tập'} trên mạng xã hội học tập của sinh viên.
Tiêu đề: ${title}
Nội dung:
${body}

Viết 2 câu hỏi tiếng Việt mà một sinh viên khác có thể gõ cho trợ lý AI, và nội dung trên trả lời được:
- "paraphrase": diễn đạt theo cách nói của sinh viên, KHÔNG dùng lại các từ khóa đặc trưng trong tiêu đề (dùng từ đồng nghĩa, mô tả vấn đề, có thể pha tiếng Anh).
- "keyword": câu hỏi tự nhiên có dùng thuật ngữ chính của nội dung.
Câu hỏi phải đủ cụ thể để chỉ nội dung này là câu trả lời phù hợp nhất. Chỉ trả JSON: {"paraphrase": "...", "keyword": "..."}`

async function buildSet(db: DatabaseService, maxPosts: number): Promise<EvalSet> {
  const docs = (
    await db.query(
      `SELECT d.id, d.title, (SELECT string_agg(c.content_text, E'\\n' ORDER BY c.chunk_index) FROM (SELECT content_text, chunk_index FROM document_chunks WHERE document_id = d.id ORDER BY chunk_index LIMIT 3) c) AS body
       FROM documents d WHERE d.visibility = 'public' AND d.index_status = 'indexed' ORDER BY d.created_at`
    )
  ).rows
  const posts = (
    await db.query(
      `SELECT p.id, COALESCE(NULLIF(p.title, ''), left(p.content, 80)) AS title, left(p.content, 2500) AS body
       FROM posts p WHERE p.visibility = 'public' AND p.hidden_at IS NULL AND length(p.content) >= 150
       ORDER BY md5(p.id::text) LIMIT $1`,
      [maxPosts]
    )
  ).rows
  const items = [...docs.map((d) => ({ ...d, kind: 'document' as Kind })), ...posts.map((p) => ({ ...p, kind: 'post' as Kind }))]
  const cases: EvalCase[] = []
  const queue = [...items]
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        try {
          const q = await llmJson(QUESTION_PROMPT(item.kind, item.title, (item.body ?? '').slice(0, 3000)))
          for (const style of ['paraphrase', 'keyword'] as Style[]) {
            if (q[style]) cases.push({ kind: item.kind, id: item.id, title: item.title, style, question: q[style] })
          }
        } catch (err: any) {
          console.warn(`Bỏ qua ${item.kind} ${item.id}: ${err?.message}`)
        }
      }
    })
  )
  return { createdAt: new Date().toISOString(), cases }
}

type Score = { n: number; hit1: number; hit3: number; hit5: number; mrr: number }
const emptyScore = (): Score => ({ n: 0, hit1: 0, hit3: 0, hit5: 0, mrr: 0 })
const pct = (x: number, n: number) => (n ? `${((x / n) * 100).toFixed(1)}%` : '-')

async function main() {
  const envFile = arg('env')
  if (envFile) process.loadEnvFile(envFile)
  const setPath = arg('set', 'rag-eval-set.json')!
  const db = new DatabaseService()
  const embedding = new EmbeddingService(new ConfigService())
  const rag = new RagSearchService(db, embedding)
  if (!embedding.enabled) throw new Error('Chưa cấu hình EMBED_BASE_URL')

  let set: EvalSet
  if (fs.existsSync(setPath)) set = JSON.parse(fs.readFileSync(setPath, 'utf8'))
  else {
    set = await buildSet(db, Number(arg('posts', '60')))
    if (!set.cases.length) throw new Error('Không sinh được câu hỏi nào (xem cảnh báo phía trên)')
    fs.writeFileSync(setPath, JSON.stringify(set, null, 2))
  }
  // Người hỏi = 1 tài khoản không sở hữu nội dung nào (chỉ thấy nội dung công khai)
  const asker = '00000000-0000-0000-0000-000000000000'

  const scores = new Map<string, Score>()
  const bump = (key: string, rank: number) => {
    const s = scores.get(key) ?? emptyScore()
    s.n++
    if (rank === 0) s.hit1++
    if (rank >= 0 && rank < 3) s.hit3++
    if (rank >= 0 && rank < K) s.hit5++
    if (rank >= 0) s.mrr += 1 / (rank + 1)
    scores.set(key, s)
  }
  const misses: { mode: RagMode; c: EvalCase; got: string[] }[] = []
  const correctSims: number[] = []

  for (const c of set.cases) {
    const query = await rag.prepare(c.question, toTsQuery(c.question))
    for (const mode of MODES) {
      const opts = { limit: K, bodyChars: 200, mode }
      const found = c.kind === 'post' ? await rag.posts(query, asker, opts) : await rag.documents(query, asker, opts)
      const rank = found.findIndex((s) => s.id === c.id)
      for (const key of [`${mode}`, `${mode}|${c.kind}`, `${mode}|${c.style}`, `${mode}|${c.kind}|${c.style}`]) bump(key, rank)
      if (mode === 'hybrid' && rank < 0) misses.push({ mode, c, got: found.map((s) => s.title) })
    }
    // Độ tương đồng của nguồn đúng (hiệu chỉnh MIN_SIMILARITY)
    if (query.vector) {
      const sql =
        c.kind === 'post'
          ? `SELECT 1 - (embedding <=> $1::vector) AS sim FROM post_embeddings WHERE post_id = $2`
          : `SELECT MAX(1 - (embedding <=> $1::vector)) AS sim FROM document_chunks WHERE document_id = $2`
      const sim = (await db.query(sql, [`[${query.vector.join(',')}]`, c.id])).rows[0]?.sim
      if (sim != null) correctSims.push(Number(sim))
    }
  }

  // Câu hỏi lạc đề: số nguồn trả về (ít ⇒ ít nhiễu đưa vào prompt)
  const offTopic: Record<RagMode, number> = { fulltext: 0, vector: 0, hybrid: 0 }
  for (const question of OFF_TOPIC) {
    const query = await rag.prepare(question, toTsQuery(question))
    for (const mode of MODES) {
      const opts = { limit: K, bodyChars: 100, mode }
      offTopic[mode] += (await rag.posts(query, asker, opts)).length + (await rag.documents(query, asker, opts)).length
    }
  }

  const sorted = [...correctSims].sort((a, b) => a - b)
  const quantile = (q: number) => sorted[Math.floor(q * (sorted.length - 1))]?.toFixed(3)
  const lines = [
    `# RAG eval — ${new Date().toISOString()}`,
    `Model: ${embedding.model}, MIN_SIMILARITY=${MIN_SIMILARITY}, câu hỏi: ${set.cases.length} (bộ tạo lúc ${set.createdAt})`,
    '',
    '| Nhóm | n | hit@1 | hit@3 | hit@5 | MRR |',
    '|---|---|---|---|---|---|'
  ]
  for (const [key, s] of [...scores.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`| ${key} | ${s.n} | ${pct(s.hit1, s.n)} | ${pct(s.hit3, s.n)} | ${pct(s.hit5, s.n)} | ${(s.mrr / s.n).toFixed(3)} |`)
  }
  lines.push('', `Câu hỏi lạc đề (${OFF_TOPIC.length} câu, tổng nguồn trả về): ${MODES.map((m) => `${m}=${offTopic[m]}`).join(', ')}`)
  lines.push(`Cosine của nguồn đúng: p10=${quantile(0.1)} p25=${quantile(0.25)} p50=${quantile(0.5)} min=${quantile(0)}`)
  lines.push('', `Hybrid trượt top-${K} (${misses.length}):`)
  for (const m of misses.slice(0, 25)) lines.push(`- [${m.c.kind}/${m.c.style}] "${m.c.question}" → cần "${m.c.title}"; được: ${m.got.slice(0, 3).join(' | ') || '(trống)'}`)
  const report = lines.join('\n')
  console.log(report)
  const out = arg('out')
  if (out) fs.writeFileSync(out, report)
  await db.onModuleDestroy()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
