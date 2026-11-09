// Đặt lại tên các thread N7AI cũ (tên đang là câu hỏi đầu bị cắt) theo ngữ cảnh. Không đụng thread người dùng đã đổi tên tay.
// Chạy (sau build): node dist/apps/api/src/modules/chat/n7ai/ai-title-backfill.cli.js --env /var/www/pu-connector/.env [--dry] [--limit 500]
import * as fs from 'node:fs'
import { ConfigService } from '@nestjs/config'
import { DatabaseService } from '../../../database/database.service'
import { LlmService } from '../../ai/llm.service'
import { AiTitleService } from './ai-title.service'
import { deriveThreadTitle } from './ai-threads.service'

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : fallback
}

function loadEnv(file?: string) {
  if (!file) return
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

async function main() {
  loadEnv(arg('env'))
  const dry = process.argv.includes('--dry')
  const limit = Number(arg('limit', '500'))
  const db = new DatabaseService()
  const llm = new LlmService(db, new ConfigService())
  const botId = await llm.getBotId()
  const titles = new AiTitleService({ db, emitTo: () => undefined } as never, llm)

  // Thread có tên = tên tự cắt từ tin đầu của người dùng ⇒ coi là tên tạm
  const rows = await db.query(
    `SELECT c.id, c.title,
            (SELECT m.content FROM messages m WHERE m.conversation_id = c.id AND m.kind <> 'system' AND m.sender_id <> $1 AND m.deleted_at IS NULL
             AND btrim(m.content) <> '' ORDER BY m.id LIMIT 1) AS first_q
     FROM conversations c
     WHERE c.type = 'ai' AND NOT c.ai_quick AND c.title IS NOT NULL
     ORDER BY COALESCE(c.last_message_at, c.created_at) DESC LIMIT $2`,
    [botId, limit]
  )
  const candidates = rows.rows.filter((r) => r.first_q && deriveThreadTitle(r.first_q) === r.title)
  console.log(`${rows.rows.length} thread, ${candidates.length} tên tạm`)
  let renamed = 0
  for (const r of candidates) {
    if (dry) {
      console.log(`[dry] ${r.id} "${r.title}"`)
      continue
    }
    await db.query(`UPDATE conversations SET title_auto = true WHERE id = $1 AND title = $2`, [r.id, r.title])
    try {
      // Thread cũ có thể dài: nới ngưỡng, vẫn chỉ đọc 6 tin đầu
      const t = await titles.retitle(r.id, botId, { maxMessages: 100000, notify: false })
      if (t) {
        renamed++
        console.log(`"${r.title}" → "${t}"`)
      } else console.log(`(giữ) "${r.title}"`)
    } catch (err) {
      console.log(`lỗi ${r.id}: ${(err as Error).message}`)
    }
  }
  console.log(`Đã đổi ${renamed}/${candidates.length}`)
  process.exit(0)
}

void main()
