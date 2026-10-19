import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const TIMEOUT_MS = 3000
const MAX_BYTES = 512 * 1024
const MAX_REDIRECTS = 3
const CACHE_TTL_MS = 60 * 60 * 1000
const CACHE_MAX = 500

export interface LinkPreview {
  title: string
  description: string
  image: string | null
  siteName: string | null
}

// Cache theo URL (cả kết quả rỗng) ⇒ không gọi lại trang ngoài mỗi lần có người gửi cùng link
// In-memory URL cache incl. negative results; bounded, oldest evicted first
const cache = new Map<string, { at: number; value: LinkPreview | null }>()

// Chặn SSRF: loopback, mạng nội bộ, link-local (metadata cloud), CGNAT, multicast
// SSRF guard: reject private / loopback / link-local / reserved addresses
export function isPrivateAddress(ip: string): boolean {
  if (ip.includes(':')) {
    const v6 = ip.toLowerCase()
    if (v6 === '::1' || v6 === '::') return true
    if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7))
    return /^(fc|fd|fe[89ab])/.test(v6) || v6.startsWith('ff')
  }
  const [a, b] = ip.split('.').map(Number)
  return (
    a === 10 || a === 127 || a === 0 || a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  )
}

async function assertPublicHost(url: URL) {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('protocol')
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('port')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error('private address')
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let size = 0
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read()
    if (done || !value) break
    chunks.push(value)
    size += value.length
  }
  void reader.cancel().catch(() => undefined)
  return Buffer.concat(chunks).toString('utf8')
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))

// Đọc thẻ <meta property|name=... content=...> (thứ tự thuộc tính bất kỳ)
function metaTags(html: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const tag of html.slice(0, 200_000).match(/<meta\s[^>]*>/gi) ?? []) {
    const key = tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase()
    const val = tag.match(/content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i)
    if (key && val && !out.has(key)) out.set(key, decode(val[1] ?? val[2] ?? '').trim())
  }
  return out
}

export function parsePreview(html: string, base: URL): LinkPreview | null {
  const meta = metaTags(html)
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  const title = meta.get('og:title') || meta.get('twitter:title') || (titleTag ? decode(titleTag).trim() : '')
  const description = meta.get('og:description') || meta.get('twitter:description') || meta.get('description') || ''
  if (!title && !description) return null
  let image: string | null = null
  const rawImage = meta.get('og:image') || meta.get('twitter:image')
  if (rawImage) {
    try {
      const abs = new URL(rawImage, base)
      image = abs.protocol === 'https:' ? abs.toString() : null // chỉ https ⇒ không mixed content
    } catch {
      image = null
    }
  }
  return { title, description, image, siteName: meta.get('og:site_name') || null }
}

export async function fetchLinkPreview(start: URL): Promise<LinkPreview | null> {
  const key = start.toString()
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value

  let value: LinkPreview | null = null
  try {
    let url = start
    // Redirect thủ công: mỗi bước kiểm lại địa chỉ đích
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertPublicHost(url)
      const res = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'user-agent': 'PUConnectorBot/1.0 (+link preview)', accept: 'text/html,application/xhtml+xml' }
      })
      const location = res.headers.get('location')
      if (res.status >= 300 && res.status < 400 && location) {
        url = new URL(location, url)
        continue
      }
      if (res.ok && /text\/html|application\/xhtml/i.test(res.headers.get('content-type') || '')) {
        value = parsePreview(await readCapped(res), url)
      }
      break
    }
  } catch {
    value = null
  }
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string)
  cache.set(key, { at: Date.now(), value })
  return value
}
