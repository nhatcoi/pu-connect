'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Ghost, Menu, SendHorizontal, Square, Trash2 } from 'lucide-react'
import { AiFollowUps } from '@/components/chat/ai/ai-follow-ups'
import { AiModelPicker } from '@/components/chat/ai/ai-model-picker'
import { AiMessageBody } from '@/components/chat/ai/ai-message-body'
import { Button } from '@/components/ui/button'
import { useTemporaryChat, type TemporaryTurn } from '@/hooks/use-temporary-chat'
import { N7AI_HOME } from '@/lib/n7ai-routes'
import { useN7AiNav } from './n7ai-nav'

const STARTERS = ['Giải thích đệ quy bằng ví dụ đơn giản', 'Tóm tắt khác biệt giữa TCP và UDP', 'Lập kế hoạch ôn thi 3 ngày cho môn Cơ sở dữ liệu']

// Chat tạm: hỏi N7AI không lưu lịch sử, không dùng / ghi bộ nhớ, không tạo học liệu; mất khi tải lại trang
export function TemporaryChat() {
  const { openNav } = useN7AiNav()
  const { turns, streaming, send, stop, clear } = useTemporaryChat()
  const [draft, setDraft] = useState('')
  const bottom = useRef<HTMLDivElement>(null)
  const lastFollowUps = turns[turns.length - 1]?.followUps ?? []

  // Cuộn theo câu trả lời đang stream
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [turns])

  const submit = (text = draft) => {
    if (!text.trim() || streaming) return
    setDraft('')
    void send(text)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="sticky top-0 z-30 flex items-center gap-2 bg-surface/90 px-2 pt-3 pb-2 backdrop-blur-md sm:px-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full md:hidden" onClick={openNav} aria-label="Lịch sử N7AI">
          <Menu className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-1.5 text-lg font-bold leading-tight">
            <Ghost className="h-4 w-4 text-primary" /> Chat tạm
          </h1>
          <p className="text-xs text-muted-foreground">Không lưu lịch sử, không dùng bộ nhớ. Mất khi bạn tải lại hoặc rời trang.</p>
        </div>
        {turns.length > 0 && (
          <Button variant="ghost" size="sm" className="shrink-0 gap-1.5 text-xs" onClick={clear}>
            <Trash2 className="h-3.5 w-3.5" /> Xóa
          </Button>
        )}
      </div>

      <div className="flex-1 space-y-4 px-3 py-3">
        {turns.length === 0 ? (
          <div className="space-y-4 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Ghost className="h-6 w-6" />
            </div>
            <p className="text-[15px] font-semibold">Hỏi thoải mái, không để lại dấu vết</p>
            <p className="mx-auto max-w-sm text-xs text-muted-foreground">
              Cuộc trò chuyện này không xuất hiện trong lịch sử, thư viện hay bộ nhớ của N7AI. Vẫn tính vào số lượt hỏi mỗi ngày.
            </p>
            <div className="mx-auto flex max-w-md flex-col gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  className="min-h-11 cursor-pointer rounded-xl bg-card px-3 py-2 text-left text-[13px] transition-colors hover:bg-primary/5"
                >
                  {s}
                </button>
              ))}
            </div>
            <Link href={N7AI_HOME} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <ArrowLeft className="h-3 w-3" /> Về chat thường
            </Link>
          </div>
        ) : (
          turns.map((t) => <TurnView key={t.id} turn={t} />)
        )}
        {!streaming && lastFollowUps.length > 0 && <AiFollowUps items={lastFollowUps} onPick={(text) => submit(text)} />}
        <div ref={bottom} />
      </div>

      <form
        className="sticky bottom-14 z-20 bg-surface/95 px-3 pt-2 pb-2.5 backdrop-blur-md md:bottom-0 sm:px-1"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="flex items-end gap-1.5 rounded-2xl bg-card px-2.5 py-1.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                submit()
              }
            }}
            rows={1}
            maxLength={8000}
            placeholder="Hỏi N7AI (chat tạm)…"
            className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none"
          />
          <AiModelPicker />
          {streaming ? (
            <Button type="button" size="icon" className="h-8 w-8 shrink-0 rounded-full" onClick={stop} aria-label="Dừng">
              <Square className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button type="submit" size="icon" className="h-8 w-8 shrink-0 rounded-full" disabled={!draft.trim()} aria-label="Gửi">
              <SendHorizontal className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}

function TurnView({ turn: t }: { turn: TemporaryTurn }) {
  if (t.role === 'user')
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-primary px-3.5 py-2 text-sm text-primary-foreground">{t.content}</div>
      </div>
    )
  if (t.status === 'error') return <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{t.content}</p>
  return (
    <div className="w-full max-w-full sm:max-w-[min(94%,52rem)]">
      <AiMessageBody
        message={{
          content: t.content,
          status: t.status === 'streaming' ? 'streaming' : 'done',
          blocks: t.citations.length ? t.citations : null,
          meta: { steps: t.steps, durationMs: t.durationMs },
          createdAt: t.startedAt
        }}
      />
    </div>
  )
}
