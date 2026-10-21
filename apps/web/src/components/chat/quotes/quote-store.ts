'use client'

import { create } from 'zustand'
import { CHAT_MAX_QUOTES, type ChatQuote } from '@pu/schemas'

interface QuoteStore {
  quotes: ChatQuote[] // đoạn đã chọn, chờ gửi cùng câu hỏi tiếp theo
  composers: number // số ô soạn N7AI đang mở; không có ô nào ⇒ nút "Hỏi N7AI" không hiện
  focusTick: number // tăng mỗi lần thêm đoạn ⇒ ô soạn nhận focus
  add: (quote: ChatQuote) => 'ok' | 'duplicate' | 'full'
  remove: (index: number) => void
  clear: () => void
  mountComposer: () => () => void
}

const same = (a: ChatQuote, b: ChatQuote) => a.title === b.title && a.locator === b.locator && a.text === b.text

// Cầu nối giữa trình xem tài liệu (panel phải) và ô soạn: chỉ giữ đoạn trích cho tới khi gửi
// Bridge between document viewers and the composer; quotes live until the next send
export const useQuoteStore = create<QuoteStore>((set, get) => ({
  quotes: [],
  composers: 0,
  focusTick: 0,
  add: (quote) => {
    const { quotes } = get()
    if (quotes.some((q) => same(q, quote))) return 'duplicate'
    if (quotes.length >= CHAT_MAX_QUOTES) return 'full'
    set((s) => ({ quotes: [...s.quotes, quote], focusTick: s.focusTick + 1 }))
    return 'ok'
  },
  remove: (index) => set((s) => ({ quotes: s.quotes.filter((_, i) => i !== index) })),
  clear: () => set({ quotes: [] }),
  // Ô soạn cuối cùng đóng (rời thread) ⇒ bỏ đoạn đang chờ, không đem sang thread khác
  mountComposer: () => {
    set((s) => ({ composers: s.composers + 1 }))
    return () => set((s) => ({ composers: s.composers - 1, quotes: s.composers - 1 > 0 ? s.quotes : [] }))
  }
}))
