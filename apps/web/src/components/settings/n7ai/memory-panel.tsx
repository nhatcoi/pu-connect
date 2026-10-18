'use client'

import React, { useState } from 'react'
import { Check, Loader2, Pencil, Pin, PinOff, Plus, Trash2, X } from 'lucide-react'
import { AI_MEMORY_LIMIT, type AiMemory } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAiMemories, useAiSettings } from '@/hooks/chat'
import { cn, formatRelativeTime } from '@/lib/utils'
import { SettingsGroup, SwitchRow } from '../settings-ui'

// Bộ nhớ dài hạn: bật/tắt, thêm tay, sửa, xóa từng mục / xóa hết
export function MemoryPanel() {
  const { settings, update } = useAiSettings()
  const { memories, isLoading, create, remove, clear } = useAiMemories()
  const [draft, setDraft] = useState('')

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    const content = draft.trim()
    if (content.length >= 3) create.mutate(content, { onSuccess: () => setDraft('') })
  }

  return (
    <>
      <SettingsGroup hint="N7AI tự ghi những điều bền về bạn (ngành, môn đang học, lịch thi, cách học) để cá nhân hóa câu trả lời. Không dùng trong nhóm chat.">
        <SwitchRow
          id="ai-memory"
          label="Cho phép N7AI ghi nhớ"
          description="Tắt ⇒ N7AI không đọc / ghi bộ nhớ (các mục đã lưu vẫn giữ đến khi bạn xóa)"
          checked={settings?.memoryEnabled ?? true}
          onCheckedChange={(memoryEnabled) => update.mutate({ memoryEnabled })}
        />
      </SettingsGroup>
      <SettingsGroup
        label={`Đã ghi nhớ (${memories.length}/${AI_MEMORY_LIMIT})`}
        hint="Ghim ⇒ N7AI luôn dùng mục đó trong mọi câu trả lời và không bị mục tự ghi mới đẩy ra."
      >
        <form onSubmit={add} className="flex items-center gap-2 py-3">
          <Input
            value={draft}
            maxLength={300}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Thêm điều N7AI nên nhớ, vd. “Mình học tốt với ví dụ code”"
          />
          <Button type="submit" size="icon" className="h-9 w-9 shrink-0 rounded-full" disabled={create.isPending || draft.trim().length < 3} aria-label="Thêm">
            <Plus className="h-4 w-4" />
          </Button>
        </form>
        {isLoading ? (
          <Loader2 className="mx-auto my-4 h-4 w-4 animate-spin text-muted-foreground" />
        ) : memories.length ? (
          memories.map((m) => <MemoryRow key={m.id} memory={m} onDelete={() => remove.mutate(m.id)} />)
        ) : (
          <p className="py-4 text-center text-xs text-muted-foreground">Chưa có gì — trò chuyện với N7AI hoặc tự thêm ở trên.</p>
        )}
      </SettingsGroup>
      {memories.length > 0 && (
        <div className="px-4 pb-5 sm:px-5">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full text-destructive"
            disabled={clear.isPending}
            onClick={() => window.confirm('Xóa toàn bộ bộ nhớ N7AI?') && clear.mutate()}
          >
            <Trash2 className="h-3.5 w-3.5" /> Xóa tất cả
          </Button>
        </div>
      )}
    </>
  )
}

function MemoryRow({ memory, onDelete }: { memory: AiMemory; onDelete: () => void }) {
  const { update, pin } = useAiMemories()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(memory.content)
  const save = () => {
    if (value.trim().length >= 3 && value !== memory.content) update.mutate({ id: memory.id, content: value.trim() })
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-2 py-2.5">
      {editing ? (
        <Input autoFocus value={value} maxLength={300} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
      ) : (
        <span className="min-w-0 flex-1">
          <span className="block text-[13px]">{memory.content}</span>
          <span className="block text-[11px] text-muted-foreground">
            {memory.pinned && 'Đã ghim · '}
            {memory.source === 'auto' ? 'N7AI ghi' : 'Bạn thêm'} · {formatRelativeTime(memory.createdAt)}
          </span>
        </span>
      )}
      {editing ? (
        <>
          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={save} aria-label="Lưu">
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => setEditing(false)} aria-label="Hủy">
            <X className="h-3.5 w-3.5" />
          </Button>
        </>
      ) : (
        <>
          <Button
            size="icon"
            variant="ghost"
            className={cn('h-7 w-7 rounded-full', memory.pinned && 'text-primary')}
            disabled={pin.isPending}
            onClick={() => pin.mutate({ id: memory.id, pinned: !memory.pinned })}
            aria-label={memory.pinned ? 'Bỏ ghim' : 'Ghim'}
            aria-pressed={memory.pinned}
          >
            {memory.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => setEditing(true)} aria-label="Sửa">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full text-destructive" onClick={onDelete} aria-label="Xóa">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
    </div>
  )
}
