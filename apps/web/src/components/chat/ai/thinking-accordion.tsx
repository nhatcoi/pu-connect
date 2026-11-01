'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Brain, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'

interface ThinkingAccordionProps {
  thinking: string
  live: boolean
  durationMs?: number
  defaultOpen?: boolean
}

export function ThinkingAccordion({ thinking, live, durationMs, defaultOpen = false }: ThinkingAccordionProps) {
  const [open, setOpen] = useState(defaultOpen || live)
  const [elapsed, setElapsed] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Đếm thời gian suy nghĩ khi đang streaming
  useEffect(() => {
    if (!live) {
      if (durationMs) setElapsed(durationMs)
      return
    }
    const start = Date.now()
    const timer = setInterval(() => {
      setElapsed(Date.now() - start)
    }, 100)
    return () => clearInterval(timer)
  }, [live, durationMs])

  // Tự cuộn xuống đáy khi có reasoning mới đến
  useEffect(() => {
    if (live && open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [thinking, live, open])

  // Khi hết live, tự động đóng lại nếu không có yêu cầu mở mặc định
  useEffect(() => {
    if (!live && !defaultOpen) {
      setOpen(false)
    }
  }, [live, defaultOpen])

  if (!thinking && !live) return null

  const seconds = (elapsed / 1000).toFixed(1)

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-border/60 bg-muted/20 text-xs">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-3 py-2 text-left font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
      >
        <span className="flex items-center gap-2">
          <Brain className={cn('h-4 w-4 text-primary', live && 'animate-pulse text-amber-500')} />
          <span>{live ? `Đang suy nghĩ... (${seconds}s)` : `Quá trình suy luận (${seconds}s)`}</span>
        </span>
        <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              ref={scrollRef}
              className="max-h-64 overflow-y-auto border-t border-border/40 bg-background/50 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap selection:bg-primary/20"
            >
              {thinking || (live && 'Khởi tạo luồng tư duy...')}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

