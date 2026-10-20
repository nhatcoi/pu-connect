import { BotApiClient } from './api-client.mjs'
import { logger } from './logger.mjs'

const SYNC_MS = 30_000

// Danh sách bot lấy từ DB (admin tạo/xóa trong Admin → Bot): tự tạo client + đăng nhập bot mới, bỏ client của bot đã xóa, đăng nhập lại bot offline
export class BotRoster {
  constructor(apiUrl, clients, policy, fallbackPersonas) {
    this.apiUrl = apiUrl
    this.clients = clients // Map<username, BotApiClient> dùng chung với scheduler
    this.policy = policy
    this.fallback = new Map(fallbackPersonas.map((p) => [p.username, p]))
    this.timer = null
  }

  password(username) {
    return process.env.BOT_PASSWORD || this.fallback.get(username)?.password || 'BotPassword@123'
  }

  async sync() {
    await this.policy.load(true)
    const live = new Set(this.policy.profiles.keys())
    for (const name of [...this.clients.keys()]) if (!live.has(name)) this.clients.delete(name)
    for (const name of live) {
      if (!this.clients.has(name)) this.clients.set(name, new BotApiClient(this.apiUrl, { username: name, password: this.password(name) }))
      const client = this.clients.get(name)
      if (!client.isLoggedIn) await client.login()
    }
  }

  start() {
    this.timer = setInterval(() => this.sync().catch((err) => logger.error('Roster sync lỗi:', err)), SYNC_MS)
    this.timer.unref()
  }

  stop() {
    clearInterval(this.timer)
  }
}
