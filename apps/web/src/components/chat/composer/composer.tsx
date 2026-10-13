'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Loader2, Paperclip, Pencil, Reply, SendHorizontal, X } from 'lucide-react'
import type { AiMode } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import { useTypingEmitter, type Draft, type UiMessage } from '@/hooks/chat'
import { cn } from '@/lib/utils'
import { AI_MODE_META } from '../ai/ai-modes'
import { messagePreview } from '../utils'
import { AiModeBar } from './ai-mode-bar'
import { AttachmentTray } from './attachment-tray'
import { useAttachmentUpload } from './use-attachment-upload'

export type ComposerHandle = { prefill: (text: string, mode?: AiMode) => void }

interface ComposerProps {
  conversationId: string
  isAi: boolean
  disabled?: boolean
  placeholder: string
  replyTo: UiMessage | null
  editing: UiMessage | null
  onCancelContext: () => void
  onSend: (draft: Draft) => void
  onEdit: (id: string, content: string) => void
  handleRef?: React.Ref<ComposerHandle>
}

// Ô soạn tin: văn bản + đính kèm (chọn / dán / kéo thả), trả lời, sửa tin, chế độ học khi chat với PU AI
export function Composer({ conversationId, isAi, disabled, placeholder, replyTo, editing, onCancelContext, onSend, onEdit, handleRef }: ComposerProps) {
  const [text, setText] = useState('')
  const [mode, setMode] = useState<AiMode>('ask')
  const [dragging, setDragging] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const typing = useTypingEmitter(conversationId)
  const uploads = useAttachmentUpload()

  React.useImperativeHandle(handleRef, () => ({
    prefill: (value, m) => {
      setText(value)
      if (m) setMode(m)
      ref.current?.focus()
    }
  }))

  // Vào chế độ sửa ⇒ nạp nội dung cũ; trả lời ⇒ focus
  useEffect(() => {
    if (editing) setText(editing.content)
    if (editing || replyTo) ref.current?.focus()
  }, [editing, replyTo])

  // Tự giãn chiều cao theo nội dung (tối đa ~6 dòng)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [text])

  const canSend = !disabled && !uploads.uploading && (text.trim().length > 0 || (!editing && uploads.ready.length > 0))

  const submit = () => {
    if (!canSend) return
    const content = text.trim()
    if (editing) {
      if (content !== editing.content) onEdit(editing.id, content)
    } else {
      onSend({ content, attachments: uploads.ready, replyTo, aiMode: isAi ? mode : undefined })
      uploads.clear()
    }
    setText('')
    onCancelContext()
    typing.stop()
  }

  const onPaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files)
    if (files.length && !editing) {
      e.preventDefault()
      uploads.add(files)
    }
  }

  const contextBar = editing ? (
    <ContextBar icon={<Pencil className="h-3.5 w-3.5" />} title="Đang sửa tin nhắn" body={messagePreview(editing)} onClose={() => {
        setText('')
        onCancelContext()
      }}
    />
  ) : replyTo ? (
    <ContextBar
      icon={<Reply className="h-3.5 w-3.5" />}
      title={`Trả lời ${replyTo.sender?.displayName ?? ''}`}
      body={messagePreview(replyTo)}
      onClose={onCancelContext}
    />
  ) : null

  return (
    <div
      className="sticky bottom-14 md:bottom-0 z-20 bg-surface/95 backdrop-blur-md px-3 sm:px-1 pt-2 pb-2.5"
      onDragOver={(e) => {
        if (editing || !e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (editing) return
        e.preventDefault()
        setDragging(false)
        uploads.add(e.dataTransfer.files)
      }}
    >
      {isAi && !editing && <AiModeBar value={mode} onChange={setMode} />}
      <div className={cn('rounded-2xl bg-card px-2.5 py-1.5 transition-shadow', dragging && 'ring-2 ring-primary ring-offset-2 ring-offset-surface')}>
        {contextBar}
        <AttachmentTray files={uploads.files} onRemove={uploads.remove} />
        <div className="flex items-end gap-1.5">
          {!editing && (
            <>
              <input
                ref={fileInput}
                type="file"
                multiple
                hidden
                accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.rar"
                onChange={(e) => {
                  if (e.target.files) uploads.add(e.target.files)
                  e.target.value = ''
                }}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-full shrink-0 text-muted-foreground"
                onClick={() => fileInput.current?.click()}
                disabled={disabled}
                aria-label="Đính kèm ảnh hoặc tệp"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </>
          )}
          <textarea
            ref={ref}
            rows={1}
            value={text}
            maxLength={4000}
            placeholder={isAi && !editing ? AI_MODE_META[mode].placeholder : placeholder}
            onPaste={onPaste}
            onChange={(e) => {
              setText(e.target.value)
              if (!isAi) typing.onInput()
            }}
            onKeyDown={(e) => {
              // Enter gửi, Shift+Enter xuống dòng (bỏ qua khi đang gõ dấu IME); Esc hủy trả lời/sửa
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                submit()
              } else if (e.key === 'Escape' && (editing || replyTo)) {
                if (editing) setText('')
                onCancelContext()
              }
            }}
            className="flex-1 resize-none bg-transparent text-sm outline-none py-1.5 max-h-40"
          />
          <Button size="icon" className="h-8 w-8 rounded-full shrink-0" disabled={!canSend} onClick={submit} aria-label="Gửi">
            {uploads.uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ContextBar({ icon, title, body, onClose }: { icon: React.ReactNode; title: string; body: string; onClose: () => void }) {
  return (
    <div className="flex items-center gap-2 mx-1 mt-0.5 mb-1.5 pl-2.5 border-l-2 border-primary">
      <span className="text-primary shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-primary">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{body}</p>
      </div>
      <button type="button" onClick={onClose} aria-label="Hủy" className="p-1 text-muted-foreground hover:text-foreground cursor-pointer">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
