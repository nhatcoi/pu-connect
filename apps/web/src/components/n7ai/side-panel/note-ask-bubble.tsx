'use client'

import React, { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Loader2, Sparkles, X } from 'lucide-react'
import type { AiNoteAskMode } from '@pu/schemas'
import { AI_NOTE_SELECTION_MAX } from '@pu/schemas'
import { useAiNoteAsk } from '@/hooks/chat/use-ai-notes'
import { cn } from '@/lib/utils'

const MODES: { id: AiNoteAskMode; label: string }[] = [
  { id: 'rewrite', label: 'Viết lại' },
  { id: 'shorten', label: 'Rút gọn' },
  { id: 'expand', label: 'Mở rộng' }
]

type Pos = { top: number; left: number }

// Chọn đoạn trong ghi chú ⇒ nút nổi "Ask n7ai"; bấm mở hộp lệnh (chế độ nhanh hoặc gõ tay) → xem trước → Dùng/Hủy
export function NoteAskBubble({ editor, noteId, containerRef }: { editor: Editor; noteId: string; containerRef: React.RefObject<HTMLDivElement | null> }) {
  const [trigger, setTrigger] = useState<Pos | null>(null)
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<Pos | null>(null)
  const [range, setRange] = useState<{ from: number; to: number } | null>(null)
  const [instruction, setInstruction] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const ask = useAiNoteAsk(noteId)

  const coordsIn = (pos: number): Pos | null => {
    const box = containerRef.current
    if (!box) return null
    const c = editor.view.coordsAtPos(pos)
    const r = box.getBoundingClientRect()
    return { top: c.bottom - r.top + box.scrollTop + 6, left: Math.min(Math.max(c.left - r.left, 4), r.width - 280) }
  }

  // Theo dõi lựa chọn: hiện nút nổi khi có đoạn chọn hợp lệ và hộp lệnh đang đóng
  useEffect(() => {
    const update = () => {
      if (open) return
      const { from, to } = editor.state.selection
      const len = to - from
      if (!editor.isFocused || len <= 0 || len > AI_NOTE_SELECTION_MAX) {
        setTrigger(null)
        return
      }
      setTrigger(coordsIn(to))
    }
    editor.on('selectionUpdate', update)
    editor.on('blur', update)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('blur', update)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, open])

  const close = () => {
    setOpen(false)
    setTrigger(null)
    setResult(null)
    setInstruction('')
    ask.reset()
  }

  const openBubble = () => {
    const { from, to } = editor.state.selection
    if (to <= from) return
    setRange({ from, to })
    setAnchor(coordsIn(to))
    setResult(null)
    setInstruction('')
    setOpen(true)
  }

  const submit = (mode: AiNoteAskMode, text?: string) => {
    if (!range) return
    const selection = editor.state.doc.textBetween(range.from, range.to, '\n')
    ask.mutate({ selection, instruction: text?.trim() || undefined, mode }, { onSuccess: (r) => setResult(r.text) })
  }

  const accept = () => {
    if (!range || !result) return
    editor.chain().focus().insertContentAt(range, result, { contentType: 'markdown' }).run()
    close()
  }

  if (!open) {
    if (!trigger) return null
    return (
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={openBubble}
        className="absolute z-20 flex items-center gap-1.5 rounded-full border border-border bg-popover px-2.5 py-1 text-xs font-medium text-foreground shadow-md hover:bg-muted"
        style={{ top: trigger.top, left: trigger.left }}
      >
        <Sparkles className="h-3.5 w-3.5 text-primary" /> Ask n7ai
      </button>
    )
  }

  const pos = anchor ?? { top: 0, left: 0 }
  return (
    <div className="absolute z-20 w-72 rounded-lg border border-border bg-popover p-2.5 shadow-lg" style={{ top: pos.top, left: pos.left }}>
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Ask n7ai
        </span>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={close} aria-label="Đóng" className="flex h-5 w-5 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {ask.isPending && (
        <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> N7AI đang sửa…
        </div>
      )}

      {!ask.isPending && result === null && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => submit(m.id)}
                className="cursor-pointer rounded-full border border-border px-2.5 py-1 text-xs text-foreground hover:bg-muted"
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && instruction.trim()) submit('none', instruction)
              }}
              placeholder="Hoặc gõ yêu cầu của bạn…"
              maxLength={400}
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
            />
            <button
              type="button"
              disabled={!instruction.trim()}
              onClick={() => submit('none', instruction)}
              className={cn('cursor-pointer rounded-md px-2 py-1 text-xs font-medium', instruction.trim() ? 'bg-primary text-primary-foreground hover:opacity-90' : 'cursor-not-allowed bg-muted text-muted-foreground')}
            >
              Gửi
            </button>
          </div>
        </div>
      )}

      {!ask.isPending && result !== null && (
        <div className="space-y-2">
          <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border border-border/60 bg-muted/40 p-2 text-xs text-foreground">{result}</div>
          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={close} className="cursor-pointer rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
              Bỏ qua
            </button>
            <button type="button" onClick={accept} className="cursor-pointer rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90">
              Dùng
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
