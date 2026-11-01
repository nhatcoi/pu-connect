'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowUp, Ghost, Menu, Square, Trash2 } from 'lucide-react'
import { AiModelPicker } from '@/components/chat/ai/ai-model-picker'
import { AiMessageBody } from '@/components/chat/ai/ai-message-body'
import { AssistantActionsBar } from '@/components/chat/ai/assistant-actions-bar'
import { ContextBudgetChip } from '@/components/chat/composer/context-budget-chip'
import { Button } from '@/components/ui/button'
import { useTemporaryChat, type TemporaryTurn } from '@/hooks/use-temporary-chat'
import { N7AI_HOME } from '@/lib/n7ai-routes'
import { cn } from '@/lib/utils'
import { useN7AiNav } from './n7ai-nav'

// Chat tạm: hỏi N7AI không lưu lịch sử, không dùng / ghi bộ nhớ, không tạo học liệu; mất khi tải lại trang
export function TemporaryChat() {
  const { openNav } = useN7AiNav()
  const { turns, streaming, send, stop, clear } = useTemporaryChat()
  const [draft, setDraft] = useState('')
  const bottom = useRef<HTMLDivElement>(null)

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

      <div className="flex-1 space-y-4 px-3 py-3 flex flex-col justify-end">
        {turns.length === 0 ? (
          <div className="flex w-full flex-1 min-h-0 items-end justify-center overflow-hidden pb-8 animate-fade-in px-4">
            <div className="w-full max-w-[768px] flex items-center justify-center gap-3.5 select-none">
              <Ghost className="h-9 w-9 text-primary shrink-0" />
              <h1 className="font-serif text-3xl sm:text-[40px] font-medium leading-[1.15] tracking-[-0.015em] text-foreground">
                What would you like to explore?
              </h1>
            </div>
          </div>
        ) : (
          turns.map((t) => <TurnView key={t.id} turn={t} onSend={(text) => submit(text)} />)
        )}
        <div ref={bottom} />
      </div>

      <form
        className="sticky bottom-14 z-20 bg-surface/95 px-3 pt-2 pb-2.5 backdrop-blur-md md:bottom-0 sm:px-1"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="relative rounded-2xl sm:rounded-[24px] border border-border/80 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-4px_rgba(0,0,0,0.06)] px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex items-start gap-2.5 w-full">
            <span
              className="w-1 h-5 rounded-full bg-primary/80 shrink-0 self-start mt-1.5 opacity-90"
              aria-hidden="true"
            />
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
              placeholder="How can I help you today?"
              className="flex-1 resize-none bg-transparent text-sm sm:text-[15px] outline-none py-1.5 min-h-[38px] max-h-40 leading-relaxed text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
            <div className="flex items-center gap-1.5">
              <Link href={N7AI_HOME} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3 w-3" /> Chat thường
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <ContextBudgetChip className="hidden sm:inline-flex" />
              <AiModelPicker />
              {streaming ? (
                <Button type="button" size="icon" className="h-8 w-8 shrink-0 rounded-full" onClick={stop} aria-label="Dừng">
                  <Square className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  className={cn(
                    'h-8 w-8 shrink-0 rounded-full cursor-pointer transition-all duration-200',
                    draft.trim()
                      ? 'bg-[#e05d38] hover:bg-[#d0532f] text-white dark:bg-[#e05d38] dark:hover:bg-[#d0532f]'
                      : 'bg-muted/40 text-muted-foreground/40 hover:bg-muted/40 cursor-not-allowed'
                  )}
                  disabled={!draft.trim()}
                  aria-label="Gửi"
                >
                  <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

function TurnView({ turn: t, onSend }: { turn: TemporaryTurn; onSend: (text: string) => void }) {
  if (t.role === 'user')
    return (
      <div className="flex flex-col items-end">
        <span className="text-[10.5px] font-medium tracking-wide text-muted-foreground pr-1 mb-1 select-none">Chat</span>
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-secondary dark:bg-[#27272a] text-foreground px-4 py-2.5 text-[14px] leading-relaxed shadow-xs">
          {t.content}
        </div>
      </div>
    )
  if (t.status === 'error') return <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{t.content}</p>
  return (
    <div className="w-full max-w-full sm:max-w-[min(98%,56rem)]">
      <AiMessageBody
        message={{
          content: t.content,
          status: t.status === 'streaming' ? 'streaming' : 'done',
          blocks: t.citations.length ? t.citations : null,
          meta: {
            steps: t.steps,
            durationMs: t.durationMs,
            reasoning: t.reasoning,
            askUser: t.askUser
          },
          createdAt: t.startedAt
        }}
        onAskUserSelect={onSend}
      />
      {t.status === 'done' && (
        <AssistantActionsBar
          message={{
            id: String(t.id),
            conversationId: 'temporary',
            sender: null,
            clientMsgId: null,
            kind: 'ai',
            content: t.content,
            blocks: null,
            attachments: null,
            replyToId: null,
            replyTo: null,
            reactions: [],
            meta: {
              durationMs: t.durationMs,
              reasoning: t.reasoning,
              steps: t.steps
            },
            status: 'done',
            deleted: false,
            editedAt: null,
            pinnedAt: null,
            createdAt: t.startedAt
          }}
          onRetry={() => onSend(t.content)}
        />
      )}
    </div>
  )
}
