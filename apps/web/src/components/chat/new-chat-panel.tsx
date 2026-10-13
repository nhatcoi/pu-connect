'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import type { SearchResult, UserSummary } from '@pu/schemas'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { chatApi } from '@/hooks/use-chat'
import { useAppStore } from '@/store'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// Tạo hội thoại mới: chọn 1 người ⇒ DM, chọn nhiều + đặt tên ⇒ nhóm
export function NewChatPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const qc = useQueryClient()
  const myId = useAppStore((s) => s.user?.id)
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [selected, setSelected] = useState<UserSummary[]>([])
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250)
    return () => clearTimeout(t)
  }, [q])

  const results = useQuery({
    queryKey: ['chat-user-search', debounced],
    queryFn: async () =>
      (await apiClient<{ success: boolean; data: SearchResult }>(`/search?q=${encodeURIComponent(debounced)}&type=users&limit=8`)).data.users,
    enabled: debounced.length >= 2,
    staleTime: 60 * 1000
  })

  const toggle = (u: UserSummary) =>
    setSelected((prev) => (prev.some((x) => x.id === u.id) ? prev.filter((x) => x.id !== u.id) : [...prev, u]))

  const start = async () => {
    if (!selected.length || busy) return
    setBusy(true)
    try {
      const conv =
        selected.length === 1
          ? await chatApi.openDirect(selected[0].id)
          : await chatApi.createGroup(title.trim() || selected.map((u) => u.displayName).join(', ').slice(0, 150), selected.map((u) => u.id))
      void qc.invalidateQueries({ queryKey: queryKeys.conversations })
      router.push(`/messages/${conv.id}`)
    } catch (err: any) {
      toast.error(err?.message || 'Không thể tạo hội thoại')
      setBusy(false)
    }
  }

  const users = (results.data ?? []).filter((u) => u.id !== myId)

  return (
    <div className="mx-2 sm:mx-0 mb-2.5 rounded-xl bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Tin nhắn mới</p>
        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <button
              key={u.id}
              onClick={() => toggle(u)}
              className="flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium cursor-pointer"
            >
              {u.displayName} <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên hoặc username" className="pl-9 h-9 text-sm rounded-full" />
      </div>

      <div className="max-h-64 overflow-y-auto -mx-1">
        {results.isFetching && !users.length ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : debounced.length >= 2 && !users.length ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Không tìm thấy người dùng.</p>
        ) : (
          users.map((u) => {
            const isSelected = selected.some((x) => x.id === u.id)
            return (
              <button
                key={u.id}
                onClick={() => toggle(u)}
                className={cn('w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left cursor-pointer hover:bg-muted/60', isSelected && 'bg-primary/5')}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={u.avatarUrl || ''} />
                  <AvatarFallback className="text-[10px] font-bold">{u.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{u.displayName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">@{u.username}</p>
                </div>
                {isSelected && <Check className="h-4 w-4 text-primary" />}
              </button>
            )
          })
        )}
      </div>

      {selected.length > 1 && (
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tên nhóm (không bắt buộc)" maxLength={150} className="h-9 text-sm" />
      )}
      <Button className="w-full rounded-full" disabled={!selected.length || busy} onClick={start}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : selected.length > 1 ? `Tạo nhóm (${selected.length + 1} người)` : 'Nhắn tin'}
      </Button>
    </div>
  )
}
