import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { lookup } from 'dns/promises'
import { isIP } from 'net'
import type { ConnectorSource } from './connector-source'

const MAX_URLS = 2
const MAX_BYTES = 1024 * 1024
const MAX_REDIRECTS = 3
const TIMEOUT_MS = 8000
const URL_RE = /https?:\/\/[^\s<>"'`)\]]+/gi
const TAVILY_URL = 'https://api.tavily.com/search'

// IP không được phép truy cập từ server (nội bộ, loopback, link-local, multicast…) — chặn SSRF
export function isPrivateIp(ip: string): boolean {
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip
  if (isIP(v4) === 4) {
    const [a, b] = v4.split('.').map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    )
  }
  const v6 = ip.toLowerCase()
  return (
    v6 === '::' ||
    v6 === '::1' ||
    v6.startsWith('fc') ||
    v6.startsWith('fd') ||
    v6.startsWith('fe8') ||
    v6.startsWith('fe9') ||
    v6.startsWith('fea') ||
    v6.startsWith('feb')
  )
}

// URL công khai, http(s) cổng mặc định, mọi IP phân giải ra đều không nội bộ
async function assertPublicUrl(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol')
  if (url.port && url.port !== '80' && url.port !== '443') throw new Error('port')
  if (url.username || url.password) throw new Error('credentials')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error('private address')
}

// HTML ⇒ chữ: bỏ script/style/khung trang, ưu tiên <article>/<main>, giải mã thực thể cơ bản
export function htmlToText(html: string): { title: string; text: string } {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? ''
  const cleaned = html.replace(/<(script|style|noscript|svg|nav|footer|header|aside|form|iframe)[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
  const main = /<article[\s\S]*?<\/article>/i.exec(cleaned)?.[0] ?? /<main[\s\S]*?<\/main>/i.exec(cleaned)?.[0] ?? cleaned
  const text = main
    .replace(/<(br|p|div|li|h[1-6]|tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { title: decode(title), text }
}
const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')

// Duyệt web cho N7AI: (1) đọc URL có trong câu hỏi; (2) tìm kiếm web qua Tavily (khi có TAVILY_API_KEY)
// Không dùng trình duyệt headless (tốn RAM, rủi ro) — chỉ tải HTML tĩnh
@Injectable()
export class WebReaderService {
  private readonly tavilyKey?: string

  constructor(config: ConfigService) {
    this.tavilyKey = config.get<string>('TAVILY_API_KEY') || undefined
  }

  canSearch(): boolean {
    return !!this.tavilyKey
  }

  // URL trong câu hỏi (≤ 2) ⇒ nội dung trang
  async readUrls(question: string, maxChars: number): Promise<ConnectorSource[]> {
    const urls = Array.from(new Set(question.match(URL_RE) ?? [])).slice(0, MAX_URLS)
    const pages = await Promise.all(urls.map((u) => this.read(u, maxChars).catch(() => null)))
    return pages.filter((p): p is ConnectorSource => !!p?.body)
  }

  async search(query: string, maxResults: number): Promise<ConnectorSource[]> {
    if (!this.tavilyKey || query.trim().length < 3) return []
    const res = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.tavilyKey}` },
      body: JSON.stringify({ query: query.slice(0, 400), max_results: maxResults, search_depth: 'basic', include_answer: false }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
    if (!res.ok) throw new Error(`Tavily HTTP ${res.status}`)
    const body = (await res.json()) as { results?: { title: string; url: string; content: string }[] }
    return (body.results ?? []).map((r) => ({ id: r.url, title: r.title || r.url, body: `${r.url}\n${r.content}`.slice(0, 1500) }))
  }

  // Tải 1 trang an toàn: kiểm tra từng chặng redirect, giới hạn kích thước & thời gian, chỉ HTML / text
  private async read(raw: string, maxChars: number): Promise<ConnectorSource | null> {
    let url = new URL(raw)
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertPublicUrl(url)
      const res = await fetch(url, {
        redirect: 'manual',
        headers: { 'User-Agent': 'N7AI-Reader/1.0 (+https://puc.vnhat.dev)', Accept: 'text/html,text/plain;q=0.9' },
        signal: AbortSignal.timeout(TIMEOUT_MS)
      })
      const location = res.headers.get('location')
      if (res.status >= 300 && res.status < 400 && location) {
        url = new URL(location, url)
        continue
      }
      if (!res.ok) return null
      const type = res.headers.get('content-type') ?? ''
      if (!/text\/(html|plain)|application\/xhtml/.test(type)) return null
      const body = await readCapped(res, MAX_BYTES)
      const { title, text } = type.includes('text/plain') ? { title: '', text: body } : htmlToText(body)
      return { id: url.toString(), title: title || url.hostname, body: `${url}\n${text.slice(0, maxChars)}` }
    }
    return null
  }
}

// Đọc thân phản hồi tối đa N byte (bỏ phần dư)
async function readCapped(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let size = 0
  while (size < maxBytes) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    size += value.length
  }
  await reader.cancel().catch(() => undefined)
  return Buffer.concat(chunks).subarray(0, maxBytes).toString('utf8')
}
