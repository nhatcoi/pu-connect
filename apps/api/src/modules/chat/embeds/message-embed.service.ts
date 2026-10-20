import { Injectable, Logger } from '@nestjs/common'
import type { ChatEmbed } from '@pu/schemas'
import { markdownToPlainText } from '../../notifications/notification.types'
import type { Queryable } from '../chat-core.service'
import { fetchLinkPreview } from './link-preview.fetcher'

const URL_RE = /https?:\/\/[^\s<>"')\]]+/i
const DESC_MAX = 160
const SETTINGS_LABELS: Record<string, string> = {
  account: 'Tài khoản',
  security: 'Đăng nhập & Bảo mật',
  privacy: 'Quyền riêng tư',
  features: 'Tính năng',
  notifications: 'Thông báo',
  appearance: 'Giao diện',
  blocked: 'Chặn & An toàn'
}

// Trang chung của app (không cần quyền riêng) ⇒ thẻ theo tên trang; trang chủ có thẻ thương hiệu
const APP_PAGES: Record<string, { title: string; description: string }> = {
  home: { title: 'Bảng tin', description: 'Bài viết mới từ cộng đồng sinh viên' },
  communities: { title: 'Cộng đồng', description: 'Cộng đồng học tập và câu lạc bộ' },
  courses: { title: 'Học phần', description: 'Danh sách học phần và tài liệu' },
  tools: { title: 'Công cụ', description: 'Flashcard, Quiz và công cụ học tập' },
  search: { title: 'Tìm kiếm', description: 'Tìm bài viết, người dùng, học phần' },
  messages: { title: 'Tin nhắn', description: 'Trò chuyện với bạn bè và nhóm' },
  n7ai: { title: 'N7AI', description: 'Trợ lý AI học tập của PU Connector' },
  notifications: { title: 'Thông báo', description: 'Thông báo từ PU Connector' }
}
const BRAND_EMBED = { title: 'PU Connector', description: 'Mạng xã hội học tập của sinh viên Phenikaa University' }

const clip = (text: string | null | undefined, max = DESC_MAX) => {
  const plain = markdownToPlainText(text || '').replace(/\s+/g, ' ').trim()
  return plain.length > max ? `${plain.slice(0, max - 1)}…` : plain
}

// Thẻ xem trước link trong tin: link nội bộ resolve bằng DB (kiểm quyền người gửi), link ngoài lấy Open Graph
// Message link previews: internal links via DB with sender permission check, external via Open Graph
@Injectable()
export class MessageEmbedService {
  private readonly logger = new Logger(MessageEmbedService.name)
  private readonly appHost = (() => {
    try {
      return new URL(process.env.APP_URL || 'http://localhost:3000').host
    } catch {
      return 'localhost:3000'
    }
  })()

  // Link đầu tiên trong nội dung (tối đa 1 thẻ / tin)
  firstUrl(content: string): URL | null {
    const match = content.match(URL_RE)
    if (!match) return null
    try {
      return new URL(match[0].replace(/[.,;:!?]+$/, ''))
    } catch {
      return null
    }
  }

  isInternal(url: URL): boolean {
    return url.host === this.appHost
  }

  // Link nội bộ: chạy trong transaction gửi tin; không nhận diện được / không có quyền ⇒ null (tin vẫn gửi bình thường)
  async resolveInternal(db: Queryable, userId: string, url: URL): Promise<ChatEmbed | null> {
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
    const [head, key] = parts
    const path = url.pathname
    if (!head) return { kind: 'page', url: '/', ...BRAND_EMBED, image: null, siteName: 'PU Connector' }
    if (parts.length === 1 && APP_PAGES[head]) return { kind: 'page', url: path, ...APP_PAGES[head], image: null, siteName: 'PU Connector' }

    if (head === 'post' && key) {
      if (!/^[0-9a-f-]{36}$/i.test(key)) return null
      const res = await db.query(
        `SELECT p.title, p.content, p.media_urls, p.is_anonymous, u.display_name, u.username
         FROM posts p JOIN users u ON u.id = p.author_id
         WHERE p.id = $1 AND p.hidden_at IS NULL AND (p.visibility = 'public' OR p.author_id = $2)`,
        [key, userId]
      )
      const row = res.rows[0]
      if (!row) return null
      const image = ((row.media_urls as string[] | null) ?? []).find((m) => !/\.(mp4|webm|mov|m4v)(\?|$)/i.test(m)) ?? null
      return { kind: 'post', url: path, title: clip(row.title, 120) || (row.is_anonymous ? 'Bài viết ẩn danh' : `Bài viết của ${row.display_name || row.username}`), description: clip(row.content), image, siteName: 'Bài viết' }
    }
    if (head === 'c' && key) {
      const res = await db.query(`SELECT name, description, avatar_url, banner_url FROM communities WHERE slug = $1`, [key])
      const row = res.rows[0]
      return row ? { kind: 'community', url: path, title: row.name, description: clip(row.description), image: row.banner_url || row.avatar_url || null, siteName: 'Cộng đồng' } : null
    }
    if (head === 'courses' && key) {
      const res = await db.query(`SELECT code, name, description FROM courses WHERE upper(code) = upper($1)`, [key])
      const row = res.rows[0]
      return row ? { kind: 'course', url: path, title: `${row.code} · ${row.name}`, description: clip(row.description), image: null, siteName: 'Học phần' } : null
    }
    if (head === 'settings' && key && SETTINGS_LABELS[key]) {
      return { kind: 'page', url: path, title: SETTINGS_LABELS[key], description: 'Cài đặt trên PU Connector', image: null, siteName: 'Cài đặt' }
    }
    // /:username (một đoạn, không trùng route hệ thống) ⇒ hồ sơ; hồ sơ riêng tư chỉ lộ tên
    if (parts.length === 1 && /^[a-zA-Z0-9_]{3,30}$/.test(head)) {
      const res = await db.query(`SELECT display_name, username, avatar_url, bio FROM users WHERE lower(username) = lower($1)`, [head])
      const row = res.rows[0]
      return row
        ? { kind: 'profile', url: path, title: row.display_name || row.username, description: clip(row.bio) || `@${row.username}`, image: row.avatar_url || null, siteName: 'Hồ sơ' }
        : null
    }
    return null
  }

  // Link ngoài: gọi sau commit (không giữ transaction / không chặn gửi tin); lỗi ⇒ null
  async resolveExternal(url: URL): Promise<ChatEmbed | null> {
    try {
      const preview = await fetchLinkPreview(url)
      if (!preview) return null
      return {
        kind: 'link',
        url: url.toString(),
        title: clip(preview.title, 140) || url.hostname,
        description: clip(preview.description),
        image: preview.image,
        siteName: preview.siteName || url.hostname.replace(/^www\./, '')
      }
    } catch (err: any) {
      this.logger.debug(`link preview ${url.hostname} failed: ${err?.message}`)
      return null
    }
  }
}
