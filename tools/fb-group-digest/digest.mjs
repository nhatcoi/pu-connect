// Personal tool: pull latest posts of a Facebook group into a daily markdown digest.
// Công cụ cá nhân: lấy bài mới của group Facebook thành bản tin markdown mỗi ngày.
// Uses your own logged-in browser profile; no password stored. Use at your own risk (FB ToS).
import { chromium } from 'playwright'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const PROFILE = path.join(DIR, '.profile')
const STATE = path.join(DIR, 'state.json')
const OUT = path.join(DIR, 'out')
const GROUP = process.env.FB_GROUP_ID || '276158668840731'
const MAX_POSTS = Number(process.env.MAX_POSTS || 30)
const MAX_SCROLLS = Number(process.env.MAX_SCROLLS || 12)
const MAX_AGE_HOURS = Number(process.env.MAX_AGE_HOURS || 36)
const INGEST_URL = process.env.BOT_INGEST_URL // vd https://puc.vnhat.dev/api/bots/ingest
const INGEST_TOKEN = process.env.BOT_INGEST_TOKEN
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const login = process.argv.includes('--login')
const headed = login || process.argv.includes('--headed')

// Redact personal data before saving / Che thông tin cá nhân
const redact = (t) =>
  t
    .replace(/(\+?84|0)[\s.-]?\d{2,3}[\s.-]?\d{3}[\s.-]?\d{3,4}\b/g, '[SĐT]')
    .replace(/\b\d{2}[A-Z]{1,2}[-\s]?\d{3}\.?\d{2}\b/g, '[biển số]')

// "15 giờ" / "2 ngày" / "30 phút" → hours; null if unknown
function ageHours(label) {
  const m = /(\d+)\s*(phút|giờ|ngày|tuần|m|h|d|w)\b/i.exec(label || '')
  if (!m) return null
  const n = Number(m[1])
  const u = m[2].toLowerCase()
  if (u === 'phút' || u === 'm') return n / 60
  if (u === 'giờ' || u === 'h') return n
  if (u === 'ngày' || u === 'd') return n * 24
  return n * 24 * 7
}

// Id bài ổn định (bỏ tham số theo dõi ?__cft__…) / Stable post id without tracking params
const postKey = (p) => {
  const m = /\/(?:posts|permalink)\/(\d+)|story_fbid=(\d+)|multi_permalinks=(\d+)/.exec(p.url)
  return m ? `fb:${m[1] || m[2] || m[3]}` : ''
}
const cleanUrl = (u) => u.split('?')[0]

// Tải ảnh ngay lúc crawl (URL Facebook có chữ ký, hết hạn) bằng phiên đã đăng nhập
async function downloadImages(request, urls) {
  const files = []
  for (const [i, url] of urls.entries()) {
    try {
      const res = await request.get(url, { timeout: 20_000 })
      const type = res.headers()['content-type'] || ''
      const body = await res.body()
      if (res.ok() && type.startsWith('image/') && body.length <= MAX_IMAGE_BYTES) files.push({ name: `img${i}.${type.split('/')[1].split(';')[0]}`, type, body })
    } catch {
      // bỏ ảnh lỗi, vẫn đăng bài
    }
  }
  return files
}

// Đẩy 1 bài lên hàng đợi bot (multipart: key, content, images). Trả status của server / Push one item to the bot queue
async function pushToBots(item, files) {
  const form = new FormData()
  form.set('key', item.key)
  form.set('content', item.text)
  for (const f of files) form.append('images', new Blob([f.body], { type: f.type }), f.name)
  const res = await fetch(INGEST_URL, { method: 'POST', headers: { 'x-bot-ingest-token': INGEST_TOKEN }, body: form })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  return (json.data ?? json).status
}

async function loadState() {
  try {
    return JSON.parse(await readFile(STATE, 'utf8'))
  } catch {
    return { seen: [] }
  }
}

async function extract(page) {
  // Runs in browser: map each article to plain data
  return page.evaluate(() => {
    const abs = (h) => new URL(h, location.origin).href
    return [...document.querySelectorAll('[role="article"]')]
      .filter((a) => !a.parentElement?.closest('[role="article"]')) // skip comment articles
      .map((a) => {
        const link = [...a.querySelectorAll('a[href]')].find((x) => /\/(posts|permalink)\/|multi_permalinks|\/photo|story_fbid/.test(x.href))
        const author = a.querySelector('h2 a, h3 a, strong a')?.textContent?.trim() || ''
        const when = link?.textContent?.trim() || ''
        const textNodes = [...a.querySelectorAll('[data-ad-comet-preview="message"], [data-ad-preview="message"], div[dir="auto"]')]
        const text = textNodes.map((n) => n.innerText?.trim()).filter(Boolean).sort((x, y) => y.length - x.length)[0] || ''
        // Chỉ ảnh trong thân bài (≥300px), bỏ avatar/emoji/biểu tượng
        const images = [...a.querySelectorAll('img[src*="scontent"]')]
          .filter((i) => i.naturalWidth >= 300 && i.naturalHeight >= 200 && !i.closest('h2, h3, h4'))
          .map((i) => i.src)
          .slice(0, 4)
        return { url: link ? abs(link.getAttribute('href')) : '', author, when, text, images }
      })
  })
}

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: !headed,
  viewport: { width: 1280, height: 900 },
  locale: 'vi-VN'
})
const page = ctx.pages()[0] || (await ctx.newPage())

if (login) {
  await page.goto('https://www.facebook.com/')
  console.log('Đăng nhập Facebook trong cửa sổ vừa mở, xong thì đóng cửa sổ.')
  await new Promise((r) => ctx.on('close', r))
  process.exit(0)
}

await page.goto(`https://www.facebook.com/groups/${GROUP}?sorting_setting=CHRONOLOGICAL`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(4000)
if (/login|checkpoint/.test(page.url())) {
  console.error('Chưa đăng nhập hoặc bị checkpoint. Chạy: pnpm login')
  await ctx.close()
  process.exit(1)
}

// Scroll slowly with jitter to load posts / Cuộn chậm, có ngẫu nhiên
const collected = new Map()
for (let i = 0; i < MAX_SCROLLS && collected.size < MAX_POSTS; i++) {
  for (const p of await extract(page)) {
    const key = postKey(p) || p.text.slice(0, 80)
    if (key && p.text && !collected.has(key)) collected.set(key, { ...p, key, url: cleanUrl(p.url) })
  }
  await page.mouse.wheel(0, 1800)
  await page.waitForTimeout(2500 + Math.random() * 2500)
}
const state = await loadState()
const seen = new Set(state.seen)
const fresh = [...collected.values()].filter((p) => {
  const h = ageHours(p.when)
  return !seen.has(p.key) && (h === null || h <= MAX_AGE_HOURS)
})

// Đẩy lên hàng đợi bot; bài đẩy lỗi mạng thì KHÔNG đánh dấu đã thấy để lần sau thử lại
const failed = new Set()
if (INGEST_URL && INGEST_TOKEN) {
  const counts = { queued: 0, duplicate: 0, rejected: 0 }
  for (const p of fresh) {
    try {
      const files = await downloadImages(ctx.request, p.images)
      const status = await pushToBots(p, files)
      counts[status] = (counts[status] ?? 0) + 1
    } catch (err) {
      failed.add(p.key)
      console.error(`Đẩy bài ${p.key} lỗi: ${err.message}`)
    }
  }
  console.log(`Đã đẩy lên bot: ${counts.queued} mới · ${counts.duplicate} trùng · ${counts.rejected} bị lọc · ${failed.size} lỗi`)
} else {
  console.log('Chưa đặt BOT_INGEST_URL / BOT_INGEST_TOKEN ⇒ chỉ lưu file local.')
}
await ctx.close()

const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
const lines = [`# Bản tin Góc Thông Tin Phenikaa — ${date}`, '', `${fresh.length} bài mới.`, '']
fresh.forEach((p, i) => {
  lines.push(`## ${i + 1}. ${p.author || 'Ẩn danh'} · ${p.when || '?'}`, '', redact(p.text), '')
  if (p.url) lines.push(`[Bài gốc](${p.url})`, '')
  p.images.forEach((u) => lines.push(`![](${u})`))
  lines.push('')
})

await mkdir(OUT, { recursive: true })
await writeFile(path.join(OUT, `${date}.md`), lines.join('\n'))
await writeFile(path.join(OUT, `${date}.json`), JSON.stringify(fresh, null, 2))
await writeFile(STATE, JSON.stringify({ seen: [...seen, ...fresh.filter((p) => !failed.has(p.key)).map((p) => p.key)].slice(-2000) }))
console.log(`Xong: ${fresh.length} bài mới → out/${date}.md`)
