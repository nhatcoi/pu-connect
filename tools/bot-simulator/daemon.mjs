// PU Connector Bot Simulator — daemon. Điều khiển từ Admin (Admin → Bot), không có CLI tương tác.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BotRoster } from './lib/bot-roster.mjs'
import { ContentGenerator } from './lib/content-generator.mjs'
import { ControlSync } from './lib/control-sync.mjs'
import { createPool } from './lib/database.mjs'
import { FeedCurator } from './lib/feed-curator.mjs'
import { FeedPoster } from './lib/feed-poster.mjs'
import { BotPolicy } from './lib/policy.mjs'
import { logger } from './lib/logger.mjs'
import { BotScheduler } from './lib/scheduler.mjs'

const dir = path.dirname(fileURLToPath(import.meta.url))
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'))
const config = readJson('config.json')
// BOT_PASSWORD (env) ghi đè mật khẩu trong personas.json — dùng trên production
const personas = readJson('personas.json').map((p) => ({ ...p, password: process.env.BOT_PASSWORD || p.password }))

// API đích: --api <url> > BOT_API_URL > config.json
const apiFlag = process.argv.indexOf('--api')
config.apiUrl = (apiFlag !== -1 && process.argv[apiFlag + 1]) || process.env.BOT_API_URL || config.apiUrl

async function main() {
  logger.info(`Bot Simulator → ${config.apiUrl}`)

  const pool = createPool()
  const policy = new BotPolicy(pool, personas)
  // Bot lấy từ DB (Admin → Bot tạo/xóa); personas.json chỉ là dữ liệu dự phòng cho bot cũ
  const clients = new Map()
  const roster = new BotRoster(config.apiUrl, clients, policy, personas)
  await roster.sync()
  const online = [...clients.values()].filter((c) => c.isLoggedIn).length
  if (online === 0) logger.warn('Không bot nào đăng nhập được. Kiểm tra API đang chạy và tài khoản bot đã được tạo (Admin → Bot)')
  else logger.success(`${online}/${clients.size} bot online`)
  roster.start()

  const contentGen = new ContentGenerator(config)
  const scheduler = new BotScheduler(config, clients, contentGen, policy)
  const sync = new ControlSync(pool, scheduler)
  await sync.start()
  scheduler.start().catch((err) => logger.error('Scheduler crashed:', err))
  const feedPoster = new FeedPoster(pool, scheduler, config, policy)
  feedPoster.start().catch((err) => logger.error('FeedPoster crashed:', err))
  const curator = new FeedCurator(pool, contentGen, policy)
  curator.start().catch((err) => logger.error('FeedCurator crashed:', err))

  const shutdown = async () => {
    logger.info('Đang tắt Bot Simulator...')
    scheduler.stop()
    feedPoster.stop()
    curator.stop()
    roster.stop()
    await sync.stop()
    await pool.end()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  logger.error('Fatal:', err)
  process.exit(1)
})
