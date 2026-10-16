'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { UserSummary } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { chatApi, refreshConversationLists } from '@/hooks/chat'
import { useAppStore } from '@/store'
import { UserPicker } from './user-picker'

// Tạo hội thoại mới: chọn 1 người ⇒ DM, chọn nhiều + đặt tên ⇒ nhóm
export function NewChatPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const qc = useQueryClient()
  const myId = useAppStore((s) => s.user?.id)
  const [selected, setSelected] = useState<UserSummary[]>([])
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const start = async () => {
    if (!selected.length || busy) return
    setBusy(true)
    try {
      const conv =
        selected.length === 1
          ? await chatApi.openDirect(selected[0].id)
          : await chatApi.createGroup(
              title.trim() ||
                selected
                  .map((u) => u.displayName)
                  .join(', ')
                  .slice(0, 150),
              selected.map((u) => u.id)
            )
      refreshConversationLists(qc)
      router.push(`/messages/${conv.id}`)
    } catch (err) {
      toast.error((err as Error)?.message || 'Không thể tạo hội thoại')
      setBusy(false)
    }
  }

  return (
    <div className="mx-2 sm:mx-0 mb-2.5 rounded-xl bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Tin nhắn mới</p>
          <p className="text-[11px] text-muted-foreground">Chọn 1 người để nhắn riêng, nhiều người để tạo nhóm học.</p>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={onClose} aria-label="Đóng">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <UserPicker selected={selected} onChange={setSelected} excludeIds={myId ? [myId] : []} />
      {selected.length > 1 && (
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tên nhóm, vd. Nhóm ôn Giải tích 2"
          maxLength={150}
          className="h-9 text-sm"
        />
      )}
      <Button className="w-full rounded-full" disabled={!selected.length || busy} onClick={start}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : selected.length > 1 ? `Tạo nhóm (${selected.length + 1} người)` : 'Nhắn tin'}
      </Button>
    </div>
  )
}
