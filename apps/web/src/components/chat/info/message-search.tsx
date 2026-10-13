'use client'

import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { chatApi } from '@/hooks/chat'
import { queryKeys } from '@/lib/query-keys'
import { formatRelativeTime } from '@/lib/utils'

// Tìm tin trong hội thoại (không dấu) ⇒ bấm để nhảy tới tin
export function MessageSearch({ conversationId, onJump }: { conversationId: string; onJump: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])
  const { data = [], isFetching } = useQuery({
    queryKey: queryKeys.chatSearch(conversationId, debounced),
    queryFn: () => chatApi.search(conversationId, debounced),
    enabled: debounced.length >= 2,
    staleTime: 30 * 1000
  })

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm trong hội thoại" className="pl-8 h-8 text-xs rounded-full" />
        {isFetching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      {debounced.length >= 2 && !isFetching && !data.length && <p className="text-center text-xs text-muted-foreground py-2">Không có kết quả.</p>}
      <div className="max-h-64 overflow-y-auto space-y-0.5">
        {data.map((m) => (
          <button key={m.id} onClick={() => onJump(m.id)} className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-muted/60 cursor-pointer">
            <span className="flex justify-between gap-2 text-[11px] text-muted-foreground">
              <span className="truncate font-medium">{m.sender?.displayName}</span>
              <span className="shrink-0">{formatRelativeTime(m.createdAt)}</span>
            </span>
            <span className="block text-xs line-clamp-2">{m.content}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
