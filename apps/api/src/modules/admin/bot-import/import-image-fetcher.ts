import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const MAX_BYTES = 8 * 1024 * 1024
const TIMEOUT_MS = 10_000
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const PRIVATE_V4 = [/^10\./, /^127\./, /^0\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./]
const PRIVATE_V6 = [/^::1$/, /^::$/, /^f[cd]/i, /^fe80/i, /^::ffff:/i]

export type FetchedImage = { buffer: Buffer; mimetype: string; originalname: string }

// SSRF guard: chỉ https, tên miền phải phân giải ra IP công cộng (không nội bộ/loopback)
async function assertPublicHost(url: URL): Promise<void> {
  if (url.protocol !== 'https:') throw new Error('chỉ nhận ảnh https')
  const addrs = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true })
  const blocked = addrs.some(({ address }) => [...PRIVATE_V4, ...PRIVATE_V6].some((re) => re.test(address)))
  if (!addrs.length || blocked) throw new Error('địa chỉ ảnh không hợp lệ')
}

// Tải ảnh từ URL do admin nhập: không theo redirect, giới hạn dung lượng + thời gian, bắt buộc content-type ảnh
export async function fetchImage(rawUrl: string): Promise<FetchedImage> {
  const url = new URL(rawUrl)
  await assertPublicHost(url)
  const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const mimetype = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (!IMAGE_TYPES.includes(mimetype)) throw new Error('không phải ảnh')
  if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) throw new Error('ảnh quá lớn')

  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    size += chunk.length
    if (size > MAX_BYTES) throw new Error('ảnh quá lớn')
    chunks.push(Buffer.from(chunk))
  }
  return { buffer: Buffer.concat(chunks), mimetype, originalname: `import.${mimetype.split('/')[1]}` }
}
