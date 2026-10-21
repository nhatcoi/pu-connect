// Lấy phụ đề YouTube (không cần API key): hỏi Innertube như ứng dụng Android, chọn track phụ đề, tải JSON ⇒ văn bản có mốc thời gian
// Trang xem video (web) trả phụ đề rỗng nếu thiếu PO token; client Android thì không cần
const PLAYER_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false'
const CLIENT_VERSION = '20.10.38'
const USER_AGENT = `com.google.android.youtube/${CLIENT_VERSION} (Linux; U; Android 14) gzip`
const TIMEOUT_MS = 10_000
const WINDOW_MS = 30_000 // gom phụ đề thành đoạn ~30 giây, mỗi đoạn một mốc [mm:ss]
const ID_RE = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})(?:[?&#/]|$)/i

export type YoutubeError = 'no-captions' | 'unavailable'

export class YoutubeTranscriptError extends Error {
  constructor(readonly code: YoutubeError) {
    super(code)
  }
}

export const youtubeId = (url: string): string | null => ID_RE.exec(url)?.[1] ?? null

export interface CaptionTrack {
  baseUrl: string
  languageCode: string
  kind?: string // 'asr' = phụ đề tự động
}

// Ưu tiên tiếng Việt, rồi tiếng Anh; phụ đề người làm trước phụ đề tự động
export function pickTrack(tracks: CaptionTrack[]): CaptionTrack {
  const rank = (t: CaptionTrack) => (['vi', 'en'].indexOf(t.languageCode.slice(0, 2)) + 1 || 9) * 2 + (t.kind === 'asr' ? 1 : 0)
  return [...tracks].sort((a, b) => rank(a) - rank(b))[0]
}

const mmss = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

type CaptionEvent = { tStartMs?: number; segs?: { utf8?: string }[] }

// Sự kiện phụ đề ⇒ các dòng "[mm:ss] chữ", mỗi dòng gom ~30 giây
export function transcriptLines(events: CaptionEvent[]): string[] {
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
  return lines
}

export interface YoutubeTranscript {
  title: string
  text: string
  lang: string
  auto: boolean
  author?: string
  seconds?: number
}

type PlayerResponse = {
  playabilityStatus?: { status?: string }
  videoDetails?: { title?: string; author?: string; lengthSeconds?: string }
  captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } }
}

async function fetchPlayer(id: string): Promise<PlayerResponse> {
  const res = await fetch(PLAYER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT, 'X-YouTube-Client-Name': '3', 'X-YouTube-Client-Version': CLIENT_VERSION },
    body: JSON.stringify({ context: { client: { clientName: 'ANDROID', clientVersion: CLIENT_VERSION, androidSdkVersion: 34, hl: 'vi', gl: 'VN' } }, videoId: id }),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  }).catch(() => null)
  if (!res?.ok) throw new YoutubeTranscriptError('unavailable')
  return (await res.json().catch(() => null)) ?? Promise.reject(new YoutubeTranscriptError('unavailable'))
}

export async function fetchYoutubeTranscript(id: string): Promise<YoutubeTranscript> {
  const player = await fetchPlayer(id)
  if (player.playabilityStatus?.status && player.playabilityStatus.status !== 'OK') throw new YoutubeTranscriptError('unavailable') // riêng tư, bị xóa, giới hạn độ tuổi…
  const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
  if (!tracks.length) throw new YoutubeTranscriptError('no-captions')

  // baseUrl đến từ nội dung bên ngoài ⇒ chỉ tin tên miền youtube.com
  const picked = pickTrack(tracks)
  const track = new URL(picked.baseUrl)
  if (track.protocol !== 'https:' || !track.hostname.endsWith('.youtube.com')) throw new YoutubeTranscriptError('unavailable')
  track.searchParams.set('fmt', 'json3')
  const res = await fetch(track, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(() => null)
  const body = res?.ok ? ((await res.json().catch(() => null)) as { events?: CaptionEvent[] } | null) : null
  if (!body) throw new YoutubeTranscriptError('unavailable')

  const lines = transcriptLines(body.events ?? [])
  if (!lines.length) throw new YoutubeTranscriptError('no-captions')
  const seconds = Number(player.videoDetails?.lengthSeconds)
  return {
    title: player.videoDetails?.title ?? `Video ${id}`,
    text: lines.join('\n'),
    lang: picked.languageCode,
    auto: picked.kind === 'asr',
    author: player.videoDetails?.author,
    seconds: Number.isFinite(seconds) && seconds > 0 ? seconds : undefined
  }
}
