'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AI_TEMPORARY_MAX_TURNS, type AiMode, type AiStep, type ChatCitation } from '@pu/schemas'
import { streamTemporaryChat } from '@/lib/n7ai-temporary'

export interface TemporaryTurn {
  id: number
  role: 'user' | 'assistant'
  content: string
  status: 'streaming' | 'done' | 'error'
  steps: AiStep[]
  citations: ChatCitation[]
  followUps: string[]
  startedAt: string
  durationMs?: number
}

// Chat tạm: toàn bộ hội thoại chỉ nằm trong state này — đóng tab / tải lại / "Xóa" là mất, server không lưu gì
export function useTemporaryChat() {
  const [turns, setTurns] = useState<TemporaryTurn[]>([])
  const turnsRef = useRef<TemporaryTurn[]>([])
  const abort = useRef<AbortController | null>(null)
  const nextId = useRef(1)
  const streaming = turns.some((t) => t.status === 'streaming')

  const commit = useCallback((next: TemporaryTurn[]) => {
    turnsRef.current = next
    setTurns(next)
  }, [])
  const patchLast = useCallback(
    (patch: Partial<TemporaryTurn>) => commit(turnsRef.current.map((t, i) => (i === turnsRef.current.length - 1 ? { ...t, ...patch } : t))),
    [commit]
  )

  const send = useCallback(
    async (content: string, aiMode: AiMode = 'ask') => {
      const text = content.trim()
      if (!text || turnsRef.current.some((t) => t.status === 'streaming')) return
      const now = new Date().toISOString()
      const base = { steps: [], citations: [], followUps: [], startedAt: now }
      // Lịch sử gửi lên: các lượt hoàn tất (bỏ lượt lỗi) + câu hỏi mới
      const history = turnsRef.current
        .filter((t) => t.status === 'done')
        .map((t) => ({ role: t.role, content: t.content }))
        .slice(-(AI_TEMPORARY_MAX_TURNS - 1))
      while (history.length && history[0].role !== 'user') history.shift()
      commit([
        ...turnsRef.current.map((t) => ({ ...t, followUps: [] })),
        { ...base, id: nextId.current++, role: 'user', content: text, status: 'done' },
        { ...base, id: nextId.current++, role: 'assistant', content: '', status: 'streaming' }
      ])
      const controller = new AbortController()
      abort.current = controller
      try {
        await streamTemporaryChat(
          { messages: [...history, { role: 'user', content: text }], aiMode },
          (e) => {
            if (e.type === 'progress') patchLast({ steps: e.steps })
            else if (e.type === 'delta') patchLast({ content: turnsRef.current[turnsRef.current.length - 1].content + e.text })
            else if (e.type === 'done')
              patchLast({ content: e.text, status: 'done', steps: e.steps, citations: e.citations, followUps: e.followUps, durationMs: e.durationMs })
            else patchLast({ content: e.message, status: 'error' })
          },
          controller.signal
        )
        if (turnsRef.current[turnsRef.current.length - 1]?.status === 'streaming') patchLast({ status: 'error', content: 'Kết nối bị gián đoạn. Bạn thử lại nhé.' })
      } catch (err) {
        if (controller.signal.aborted) patchLast({ status: 'done', content: turnsRef.current[turnsRef.current.length - 1].content || '(Đã dừng)' })
        else patchLast({ status: 'error', content: err instanceof Error ? err.message : 'N7AI gặp lỗi. Bạn thử lại nhé.' })
      } finally {
        abort.current = null
      }
    },
    [commit, patchLast]
  )

  const stop = useCallback(() => abort.current?.abort(), [])
  const clear = useCallback(() => {
    abort.current?.abort()
    commit([])
  }, [commit])
  // Rời trang ⇒ hủy luồng đang chạy
  useEffect(() => () => abort.current?.abort(), [])

  return { turns, streaming, send, stop, clear }
}
