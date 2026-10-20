// PU Connector Bot Simulator — daemon. Điều khiển từ Admin (Admin → Bot), không có CLI tương tác.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BotApiClient } from './lib/api-client.mjs'
import { ContentGenerator } from './lib/content-generator.mjs'
import { ControlSync } from './lib/control-sync.mjs'
import { createPool } from './lib/database.mjs'
import { FeedPoster } from './lib/feed-poster.mjs'
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
  logger.info(`Bot Simulator → ${config.apiUrl} | mode=${config.simulation.mode} | ${personas.length} persona`)

  const clients = new Map(personas.map((p) => [p.username, new BotApiClient(config.apiUrl, p)]))
  let online = 0
  for (const client of clients.values()) if (await client.login()) online++
  if (online === 0) logger.warn('Không bot nào đăng nhập được. Kiểm tra API đang chạy và đã chạy: pnpm bot:setup')
  else logger.success(`${online}/${personas.length} bot online`)

  // Bot offline (API vừa restart, lỗi mạng) ⇒ thử đăng nhập lại mỗi phút
  setInterval(async () => {
    for (const client of clients.values()) if (!client.isLoggedIn) await client.login()
  }, 60_000).unref()

  const scheduler = new BotScheduler(config, personas, clients, new ContentGenerator(config))
  const pool = createPool()
  const sync = new ControlSync(pool, scheduler)
  await sync.start()
  scheduler.start().catch((err) => logger.error('Scheduler crashed:', err))
  const feedPoster = new FeedPoster(pool, scheduler, config)
  feedPoster.start().catch((err) => logger.error('FeedPoster crashed:', err))

  const shutdown = async () => {
    logger.info('Đang tắt Bot Simulator...')
    scheduler.stop()
    feedPoster.stop()
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
