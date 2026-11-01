'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy, Loader2, NotebookPen, RotateCcw, Square, Trash2, Volume2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAddToNote } from '@/hooks/chat/use-ai-notes'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { UsageFooter } from './usage-footer'
import { estimateMessageUsage } from './usage-summary'
import type { UiMessage } from '@/hooks/chat'

interface AssistantActionsBarProps {
  message: UiMessage
  onRetry?: () => void
  onDelete?: () => void
}

export function AssistantActionsBar({ message: m, onRetry, onDelete }: AssistantActionsBarProps) {
  const content = m.content || ''
  const usage = estimateMessageUsage(content, m.meta)

  return (
    <div className="mt-2.5 flex items-center justify-between text-muted-foreground">
      <div className="flex shrink-0 items-center gap-0.5">
        <CopyActionButton content={content} />
        <PlayAudioButton content={content} />
        {content.trim() && m.status === 'done' && <AddToNoteButton content={content} conversationId={m.conversationId} />}
        {onRetry && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onRetry}
                  aria-label="Thử lại"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground cursor-pointer"
                >
                  <RotateCcw size={14} strokeWidth={1.7} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <span className="text-xs">Thử lại</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {onDelete && <DeleteActionButton onDelete={onDelete} />}
      </div>

      <div className="flex min-w-0 flex-1 justify-end pl-2">
        <UsageFooter turn={usage} />
      </div>
    </div>
  )
}

function CopyActionButton({ content }: { content: string }) {
  const [outcome, setOutcome] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content)
      setOutcome('copied')
    } catch {
      setOutcome('failed')
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setOutcome('idle'), 1600)
  }, [content])

  const label = outcome === 'copied' ? 'Đã sao chép' : outcome === 'failed' ? 'Lỗi sao chép' : 'Sao chép'

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={label}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors cursor-pointer ${
              outcome === 'copied'
                ? 'text-primary'
                : outcome === 'failed'
                  ? 'text-destructive'
                  : 'text-muted-foreground/80 hover:bg-muted/60 hover:text-foreground'
            }`}
          >
            {outcome === 'copied' ? (
              <Check size={14} strokeWidth={2} />
            ) : outcome === 'failed' ? (
              <X size={14} strokeWidth={2} />
            ) : (
              <Copy size={14} strokeWidth={1.7} />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <span className="text-xs">{label}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function PlayAudioButton({ content }: { content: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle')

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setState('idle')
  }, [])

  const play = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()

    // Strip markdown formatting before reading aloud
    const plainText = content
      .replace(/[#*`_~[\]()]/g, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (!plainText) return

    setState('loading')
    const utterance = new SpeechSynthesisUtterance(plainText)

    // Detect language: Vietnamese if contains Vietnamese accent characters
    const isVietnamese = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(plainText)
    utterance.lang = isVietnamese ? 'vi-VN' : 'en-US'
    utterance.rate = 1.0

    utterance.onstart = () => {
      setState('playing')
    }
    utterance.onend = () => {
      setState('idle')
    }
    utterance.onerror = () => {
      setState('idle')
    }

    window.speechSynthesis.speak(utterance)
  }, [content])

  const handleClick = useCallback(() => {
    if (state === 'playing' || state === 'loading') {
      stop()
    } else {
      play()
    }
  }, [play, state, stop])

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const label = state === 'playing' ? 'Dừng đọc' : 'Đọc to'

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            aria-label={label}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors cursor-pointer ${
              state === 'playing'
                ? 'text-primary'
                : 'text-muted-foreground/80 hover:bg-muted/60 hover:text-foreground'
            }`}
          >
            {state === 'loading' ? (
              <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />
            ) : state === 'playing' ? (
              <Square size={12} strokeWidth={1.8} className="fill-current" />
            ) : (
              <Volume2 size={14} strokeWidth={1.7} />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <span className="text-xs">{label}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function DeleteActionButton({ onDelete }: { onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false)

  if (confirm) {
    return (
      <div className="inline-flex items-center gap-1.5 px-1 text-[11px] animate-in fade-in duration-100">
        <span className="text-muted-foreground text-[11px]">Xóa tin này?</span>
        <button
          type="button"
          onClick={() => {
            onDelete()
            setConfirm(false)
          }}
          className="rounded px-1.5 py-0.5 font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
        >
          Xóa
        </button>
        <button
          type="button"
          onClick={() => setConfirm(false)}
          className="rounded px-1.5 py-0.5 font-medium text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer"
        >
          Hủy
        </button>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setConfirm(true)}
            aria-label="Xóa tin nhắn"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground cursor-pointer"
          >
            <Trash2 size={14} strokeWidth={1.7} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <span className="text-xs">Xóa tin</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function AddToNoteButton({ content, conversationId }: { content: string; conversationId: string }) {
  const addToNote = useAddToNote()
  const [busy, setBusy] = useState(false)
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              addToNote(content, conversationId)
                .catch((e: Error) => toast.error(e.message || 'Không thêm được vào ghi chú'))
                .finally(() => setBusy(false))
            }}
            aria-label="Thêm vào ghi chú"
            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <NotebookPen size={14} strokeWidth={1.7} />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <span className="text-xs">Thêm vào ghi chú</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
