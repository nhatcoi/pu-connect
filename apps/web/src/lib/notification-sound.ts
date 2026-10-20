// Tiếng bíp thông báo trong app (Web Audio, không cần tệp âm thanh); bật/tắt theo thiết bị (localStorage)
const KEY = 'pu:notification-sound'
export type SoundKind = 'message' | 'notification'

// [tần số Hz, bắt đầu s, độ dài s]: tin nhắn = 2 nốt lên; thông báo = 1 nốt
const TONES: Record<SoundKind, [number, number, number][]> = {
  message: [
    [880, 0, 0.11],
    [1175, 0.12, 0.14]
  ],
  notification: [[740, 0, 0.16]]
}
const VOLUME = 0.12
const MIN_GAP_MS = 900 // nhiều tin dồn dập ⇒ chỉ bíp 1 lần

let ctx: AudioContext | null = null
let lastPlayedAt = 0
let unlockBound = false

export function isSoundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0'
  } catch {
    return true
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    // trình duyệt chặn localStorage ⇒ giữ mặc định
  }
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  ctx ??= new Ctor()
  return ctx
}

// Trình duyệt chỉ cho phát âm sau 1 lần người dùng bấm / gõ phím ⇒ mở khóa ở lần tương tác đầu tiên
export function bindSoundUnlock() {
  if (unlockBound || typeof window === 'undefined') return
  unlockBound = true
  const unlock = () => {
    void audio()?.resume()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

// force = nút "Thử âm thanh" (bỏ qua công tắc và khoảng nghỉ)
export function playNotificationSound(kind: SoundKind, force = false) {
  if (!force && (!isSoundEnabled() || Date.now() - lastPlayedAt < MIN_GAP_MS)) return
  try {
    const c = audio()
    if (!c) return
    if (c.state === 'suspended') void c.resume()
    lastPlayedAt = Date.now()
    const now = c.currentTime
    for (const [freq, start, length] of TONES[kind]) {
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      // Vào / ra nhẹ để không bị tiếng "tách"
      gain.gain.setValueAtTime(0.0001, now + start)
      gain.gain.exponentialRampToValueAtTime(VOLUME, now + start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + length)
      osc.connect(gain).connect(c.destination)
      osc.start(now + start)
      osc.stop(now + start + length + 0.02)
    }
  } catch {
    // không phát được (chưa tương tác / thiết bị âm thanh) ⇒ bỏ qua
  }
}
