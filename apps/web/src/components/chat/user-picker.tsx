'use client'

import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Loader2, Search, X } from 'lucide-react'
import type { SearchResult, UserSummary } from '@pu/schemas'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { apiClient } from '@/lib/api-client'
import { cn } from '@/lib/utils'

// Tìm & chọn nhiều người dùng (tạo nhóm, thêm thành viên); excludeIds: đã ở trong nhóm / chính mình
export function UserPicker({
  selected,
  onChange,
  excludeIds = []
}: {
  selected: UserSummary[]
  onChange: (users: UserSummary[]) => void
  excludeIds?: string[]
}) {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250)
    return () => clearTimeout(t)
  }, [q])

  const results = useQuery({
    queryKey: ['chat-user-search', debounced],
    queryFn: async () => (await apiClient<{ success: boolean; data: SearchResult }>(`/search?q=${encodeURIComponent(debounced)}&type=users&limit=8`)).data.users,
    enabled: debounced.length >= 2,
    staleTime: 60 * 1000
  })

  const toggle = (u: UserSummary) => onChange(selected.some((x) => x.id === u.id) ? selected.filter((x) => x.id !== u.id) : [...selected, u])
  const users = (results.data ?? []).filter((u) => !excludeIds.includes(u.id))

  return (
    <div className="space-y-3">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <button key={u.id} onClick={() => toggle(u)} className="flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium cursor-pointer">
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
        ) : debounced.length < 2 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">Nhập ít nhất 2 ký tự để tìm.</p>
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
    </div>
  )
}
