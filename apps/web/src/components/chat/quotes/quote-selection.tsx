'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { TextQuote } from 'lucide-react'
import { toast } from 'sonner'
import { CHAT_MAX_QUOTES } from '@pu/schemas'
import { readSelection, type SelectionInfo } from './read-selection'
import { useQuoteStore } from './quote-store'

const BUTTON_W = 120

// Bôi đen chữ trong vùng con ⇒ nút nổi "Hỏi N7AI"; bấm ⇒ đoạn thành chip trong ô soạn (không tự gắn khi chỉ bôi đen)
// Vùng không tạo thêm khung bố cục (display: contents); chỉ hoạt động khi có ô soạn N7AI đang mở
export function QuoteSelection({ title, sourceId, children }: { title: string; sourceId?: string; children: React.ReactNode }) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const enabled = useQuoteStore((s) => s.composers > 0)
  const [info, setInfo] = useState<SelectionInfo | null>(null)

  useEffect(() => {
    if (!enabled) return
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setInfo(rootRef.current ? readSelection(rootRef.current) : null))
    }
    document.addEventListener('selectionchange', update)
    window.addEventListener('scroll', update, true) // cuộn trong panel ⇒ nút theo chữ đang chọn
    window.addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('selectionchange', update)
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
      setInfo(null)
    }
  }, [enabled])

  const ask = () => {
    if (!info) return
    const result = useQuoteStore.getState().add({ title, text: info.text, ...(info.locator ? { locator: info.locator } : {}), ...(sourceId ? { sourceId } : {}) })
    window.getSelection()?.removeAllRanges()
    setInfo(null)
    if (result === 'full') toast.error(`Tối đa ${CHAT_MAX_QUOTES} đoạn mỗi tin — gửi hoặc bỏ bớt trước khi thêm`)
    else if (info.truncated) toast.info('Đoạn dài nên chỉ lấy phần đầu')
  }

  // Màn cảm ứng: menu chọn của hệ điều hành nằm phía trên ⇒ nút đặt bên dưới vùng chọn
  const touch = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches
  const left = info ? Math.min(Math.max(info.rect.left + info.rect.width / 2, BUTTON_W / 2 + 8), window.innerWidth - BUTTON_W / 2 - 8) : 0
  const top = info ? (touch ? info.rect.bottom + 10 : Math.max(info.rect.top - 42, 8)) : 0

  return (
    <>
      <div ref={rootRef} className="contents">
        {children}
      </div>
      {enabled &&
        info &&
        createPortal(
          <button
            type="button"
            // Giữ nguyên vùng chọn khi bấm nút
            onMouseDown={(e) => e.preventDefault()}
            onClick={ask}
            style={{ top, left, width: BUTTON_W }}
            className="fixed z-[70] flex h-8 -translate-x-1/2 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-primary text-xs font-medium text-primary-foreground shadow-lg transition-opacity hover:opacity-90"
          >
            <TextQuote className="h-3.5 w-3.5" /> Hỏi N7AI
          </button>,
          document.body
        )}
    </>
  )
}
