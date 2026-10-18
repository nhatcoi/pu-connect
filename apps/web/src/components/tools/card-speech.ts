'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SpeechLang } from '@pu/schemas'

// Phát âm thẻ bằng Web Speech API (chạy trên trình duyệt, không tốn lượt / server)
// Card pronunciation via the browser's speechSynthesis

export const SPEECH_LANG_LABELS: Record<SpeechLang, string> = {
  'en-US': 'Tiếng Anh (Mỹ)',
  'en-GB': 'Tiếng Anh (Anh)',
  'vi-VN': 'Tiếng Việt',
  'zh-CN': 'Tiếng Trung',
  'ja-JP': 'Tiếng Nhật',
  'ko-KR': 'Tiếng Hàn',
  'fr-FR': 'Tiếng Pháp',
  'de-DE': 'Tiếng Đức',
  'es-ES': 'Tiếng Tây Ban Nha',
  'ru-RU': 'Tiếng Nga'
}

// Bỏ Markdown / LaTeX / loại từ "(n)", "(adj)" trước khi đọc
const POS = /\((?:n|v|adj|adv|prep|conj|pron|det|int|phr\.?\s?v|v\.?\s?phr|idiom)\.?\)/gi
export const speechText = (md: string) =>
  md
    .replace(/\$\$?[^$]*\$\$?/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(POS, ' ')
    .replace(/[*_`#>~|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

// Đoán ngôn ngữ khi bộ chưa chọn: chữ Nhật / Hàn / Trung / Nga / có dấu tiếng Việt / còn lại tiếng Anh
const VI = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i
export function guessLang(text: string): SpeechLang {
  if (/[぀-ヿ]/.test(text)) return 'ja-JP'
  if (/[가-힯]/.test(text)) return 'ko-KR'
  if (/[一-鿿]/.test(text)) return 'zh-CN'
  if (/[а-яё]/i.test(text)) return 'ru-RU'
  if (VI.test(text)) return 'vi-VN'
  return 'en-US'
}

function pickVoice(lang: string) {
  const voices = window.speechSynthesis.getVoices()
  const base = lang.split('-')[0]
  return voices.find((v) => v.lang === lang) ?? voices.find((v) => v.lang.replace('_', '-').startsWith(base)) ?? null
}

// supported chỉ biết sau khi mount (tránh lệch SSR); speak() hủy câu đang đọc trước
export function useSpeech() {
  const [supported, setSupported] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    setSupported(true)
    // Một số trình duyệt nạp danh sách giọng bất đồng bộ
    window.speechSynthesis.getVoices()
    return () => window.speechSynthesis.cancel()
  }, [])

  const speak = useCallback((text: string, lang?: SpeechLang | null) => {
    if (!('speechSynthesis' in window)) return
    const clean = speechText(text)
    if (!clean) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(clean)
    u.lang = lang ?? guessLang(clean)
    const voice = pickVoice(u.lang)
    if (voice) u.voice = voice
    u.rate = 0.92
    u.onstart = () => setSpeaking(true)
    u.onend = u.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(u)
  }, [])

  return { supported, speaking, speak }
}
