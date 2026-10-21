export interface TranscriptLine {
  seconds: number
  time: string // "mm:ss" hoặc "h:mm:ss"
  text: string
}

const LINE = /^\[(\d{2,}):(\d{2})\]\s?(.*)$/

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(s).padStart(2, '0')}`
}

// Phụ đề lưu dạng "[mm:ss] chữ" mỗi dòng ⇒ danh sách có số giây để tua video
export function parseTranscript(content: string): TranscriptLine[] {
  return content.split('\n').flatMap((raw) => {
    const m = LINE.exec(raw)
    if (!m) return []
    const seconds = Number(m[1]) * 60 + Number(m[2])
    return [{ seconds, time: formatTime(seconds), text: m[3] }]
  })
}

// Dòng đang phát: dòng cuối có mốc ≤ thời điểm hiện tại (-1 nếu chưa tới dòng nào)
export function activeLine(lines: TranscriptLine[], currentTime: number): number {
  let lo = 0
  let hi = lines.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].seconds <= currentTime) {
      found = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return found
}
