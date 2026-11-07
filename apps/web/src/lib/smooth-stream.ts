// Làm mượt chữ N7AI stream: delta từ socket đến theo cụm (to nhỏ thất thường) ⇒ xếp hàng rồi nhả đều theo khung hình
// (thích nghi: hàng đợi càng dài nhả càng nhanh, nên luôn đuổi kịp server) — độ trễ hiển thị chỉ vài trăm ms.

type Entry = { pending: string; emit: (chunk: string) => void; lastEmit: number; done?: () => void; deadline?: number }

const entries = new Map<string, Entry>()
let raf = 0
let last = 0

const EMIT_GAP_MS = 28 // ≤ ~35 lần cập nhật / giây: đủ mượt, không render lại markdown quá dày
const FORCE_FLUSH_MS = 1200 // xả nốt tối đa chừng này sau khi server báo xong

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Không cắt đôi cặp surrogate (emoji…)
function safeCut(text: string, n: number): number {
  if (n < text.length) {
    const c = text.charCodeAt(n - 1)
    if (c >= 0xd800 && c <= 0xdbff) return n + 1
  }
  return Math.min(n, text.length)
}

function tick(now: number) {
  raf = 0
  const dt = Math.min(64, now - (last || now - 16))
  last = now
  for (const [id, e] of entries) {
    if (e.pending) {
      if (now - e.lastEmit >= EMIT_GAP_MS || e.done) {
        const finishing = !!e.done
        // Bám hàng đợi: ~1/10 mỗi 16ms (xong rồi ⇒ nhanh gấp ~3); tối thiểu 1 ký tự / khung
        const share = (finishing ? 0.34 : 0.1) * (Math.max(dt, EMIT_GAP_MS) / 16)
        let n = Math.max(1, Math.ceil(e.pending.length * Math.min(1, share)))
        if (e.deadline && now >= e.deadline) n = e.pending.length
        n = safeCut(e.pending, n)
        const chunk = e.pending.slice(0, n)
        e.pending = e.pending.slice(n)
        e.lastEmit = now
        e.emit(chunk)
      }
    }
    if (!e.pending && e.done) {
      entries.delete(id)
      e.done()
    }
  }
  if (entries.size) raf = requestAnimationFrame(tick)
  else last = 0
}

function kick() {
  if (!raf) raf = requestAnimationFrame(tick)
}

/** Nhận một cụm delta; trả về true nếu đã nhận (sẽ nhả dần qua `emit`). */
export function pushSmooth(id: string, delta: string, emit: (chunk: string) => void): void {
  // Tab ẩn (rAF tạm dừng) hoặc người dùng giảm chuyển động ⇒ hiện ngay
  if (typeof document === 'undefined' || document.hidden || reduced()) {
    const e = entries.get(id)
    if (e?.pending) {
      emit(e.pending)
      e.pending = ''
    }
    return emit(delta)
  }
  const e = entries.get(id)
  if (e) {
    e.pending += delta
    e.emit = emit
  } else entries.set(id, { pending: delta, emit, lastEmit: 0 })
  kick()
}

export const isSmoothing = (id: string) => entries.has(id)

/** Server đã xong: nhả nốt phần còn lại (nhanh hơn) rồi mới gọi `done` (áp dụng tin hoàn chỉnh). */
export function finishSmooth(id: string, done: () => void): void {
  const e = entries.get(id)
  if (!e) return done()
  if (document.hidden) {
    e.emit(e.pending)
    entries.delete(id)
    return done()
  }
  e.done = done
  e.deadline = performance.now() + FORCE_FLUSH_MS
  kick()
}
