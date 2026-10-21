// Lấy phụ đề YouTube (không cần API key): đọc trang xem video, chọn track phụ đề, tải JSON ⇒ văn bản có mốc thời gian
const WATCH_URL = 'https://www.youtube.com/watch'
const TIMEOUT_MS = 10_000
const WINDOW_MS = 30_000 // gom phụ đề thành đoạn ~30 giây, mỗi đoạn một mốc [mm:ss]
const ID_RE = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})(?:[?&#/]|$)/i
const PLAYER_RE = /ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?\})\s*;\s*(?:var\s|<\/script>)/

export type YoutubeError = 'no-captions' | 'unavailable'

export class YoutubeTranscriptError extends Error {
  constructor(readonly code: YoutubeError) {
    super(code)
  }
}

export const youtubeId = (url: string): string | null => ID_RE.exec(url)?.[1] ?? null

interface CaptionTrack {
  baseUrl: string
  languageCode: string
  kind?: string // 'asr' = phụ đề tự động
}

// Ưu tiên tiếng Việt, rồi tiếng Anh; phụ đề người làm trước phụ đề tự động
function pickTrack(tracks: CaptionTrack[]): CaptionTrack {
  const rank = (t: CaptionTrack) => (['vi', 'en'].indexOf(t.languageCode.slice(0, 2)) + 1 || 9) * 2 + (t.kind === 'asr' ? 1 : 0)
  return [...tracks].sort((a, b) => rank(a) - rank(b))[0]
}

const mmss = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export async function fetchYoutubeTranscript(id: string): Promise<{ title: string; text: string }> {
  const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; N7AI-Reader/1.0)', 'Accept-Language': 'vi,en;q=0.8', Cookie: 'CONSENT=YES+1' }
  const page = await fetch(`${WATCH_URL}?v=${id}&hl=vi`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(() => null)
  if (!page?.ok) throw new YoutubeTranscriptError('unavailable')
  const match = PLAYER_RE.exec(await page.text())
  if (!match) throw new YoutubeTranscriptError('unavailable')

  const player = JSON.parse(match[1]) as {
    videoDetails?: { title?: string }
    captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } }
  }
  const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
  if (!tracks.length) throw new YoutubeTranscriptError('no-captions')

  // baseUrl đến từ nội dung bên ngoài ⇒ chỉ tin tên miền youtube.com
  const track = new URL(pickTrack(tracks).baseUrl)
  if (track.protocol !== 'https:' || !track.hostname.endsWith('.youtube.com')) throw new YoutubeTranscriptError('unavailable')
  track.searchParams.set('fmt', 'json3')
  const res = await fetch(track, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(() => null)
  if (!res?.ok) throw new YoutubeTranscriptError('unavailable')

  const { events = [] } = (await res.json()) as { events?: { tStartMs?: number; segs?: { utf8?: string }[] }[] }
  const lines: string[] = []
  let windowStart = -WINDOW_MS
  for (const e of events) {
    const text = (e.segs ?? []).map((s) => s.utf8 ?? '').join('').replace(/\s+/g, ' ').trim()
    if (!text || e.tStartMs === undefined) continue
    if (e.tStartMs - windowStart >= WINDOW_MS) {
      windowStart = e.tStartMs
      lines.push(`[${mmss(e.tStartMs)}] ${text}`)
    } else lines[lines.length - 1] += ` ${text}`
  }
  if (!lines.length) throw new YoutubeTranscriptError('no-captions')
  return { title: player.videoDetails?.title ?? `Video ${id}`, text: lines.join('\n') }
}
