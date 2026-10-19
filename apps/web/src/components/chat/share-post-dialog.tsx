'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Loader2, Search, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { CHAT_SHARE_MAX_TARGETS, type ConversationSummary, type PostItem, type SearchResult, type UserSummary } from '@pu/schemas'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { UserListSkeleton } from '@/components/skeletons/user-row-skeleton'
import { conversationTitle, useConversations, useSharePost } from '@/hooks/chat'
import { apiClient } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { ConversationAvatar } from './conversation-avatar'

// Đích chia sẻ: hội thoại có sẵn (DM / nhóm) hoặc người chưa nhắn (server tự mở DM)
type Target = { kind: 'conversation'; id: string; label: string; conversation: ConversationSummary } | { kind: 'user'; id: string; label: string; user: UserSummary }

const RECENT_LIMIT = 12
const keyOf = (t: Target) => `${t.kind}:${t.id}`
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()

interface Props {
  post: Pick<PostItem, 'id' | 'title' | 'content'>
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Gửi bài viết vào tin nhắn: hội thoại gần đây hoặc tìm người / nhóm, chọn nhiều nơi, kèm lời nhắn
// Share-to-chat picker: recent chats + user search, multi-select, optional note
// Chỉ mount khi mở (danh sách hội thoại không tải theo từng bài trên feed; đóng ⇒ lựa chọn tự xóa)
export function SharePostDialog({ post, open, onOpenChange }: Props) {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [selected, setSelected] = useState<Target[]>([])
  const [note, setNote] = useState('')
  const share = useSharePost()
  const { conversations, isPending: loadingRecent } = useConversations('all')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250)
    return () => clearTimeout(t)
  }, [q])

  const users = useQuery({
    queryKey: ['chat-user-search', debounced],
    queryFn: async () =>
      (await apiClient<{ success: boolean; data: SearchResult }>(`/search?q=${encodeURIComponent(debounced)}&type=users&limit=8`)).data.users,
    enabled: open && debounced.length >= 2,
    staleTime: 60 * 1000
  })

  // Không có từ khóa: hội thoại gần nhất; có từ khóa: hội thoại khớp tên + người dùng (bỏ người đã có DM trong danh sách)
  const options = useMemo<Target[]>(() => {
    const chats = conversations.filter((c) => c.type === 'direct' || c.type === 'group')
    const asTarget = (c: ConversationSummary): Target => ({ kind: 'conversation', id: c.id, label: conversationTitle(c), conversation: c })
    if (debounced.length < 2) return chats.slice(0, RECENT_LIMIT).map(asTarget)
    const term = fold(debounced)
    const matched = chats.filter((c) => fold(conversationTitle(c)).includes(term)).map(asTarget)
    const dmPeers = new Set(chats.filter((c) => c.type === 'direct').map((c) => c.members[0]?.id))
    const people = (users.data ?? []).filter((u) => !dmPeers.has(u.id)).map((u): Target => ({ kind: 'user', id: u.id, label: u.displayName, user: u }))
    return [...matched, ...people]
  }, [conversations, debounced, users.data])

  const isSelected = (t: Target) => selected.some((x) => keyOf(x) === keyOf(t))
  const toggle = (t: Target) => {
    if (isSelected(t)) return setSelected(selected.filter((x) => keyOf(x) !== keyOf(t)))
    if (selected.length >= CHAT_SHARE_MAX_TARGETS) return void toast.error(`Gửi tối đa ${CHAT_SHARE_MAX_TARGETS} nơi mỗi lần`)
    setSelected([...selected, t])
  }

  const submit = () => {
    share.mutate(
      {
        postId: post.id,
        conversationIds: selected.filter((t) => t.kind === 'conversation').map((t) => t.id),
        userIds: selected.filter((t) => t.kind === 'user').map((t) => t.id),
        note: note.trim() || undefined
      },
      {
        onSuccess: (res) => {
          if (res.failed > 0) toast.warning(`Đã gửi tới ${res.sent} nơi, ${res.failed} nơi không gửi được`)
          else toast.success(res.sent > 1 ? `Đã gửi tới ${res.sent} nơi` : 'Đã gửi bài viết')
          onOpenChange(false)
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Không gửi được, thử lại sau')
      }
    )
  }

  const searching = debounced.length >= 2
  const loading = searching ? users.isFetching && !options.length : loadingRecent

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0">
        <div className="px-4 pt-4 pb-3 space-y-1">
          <DialogTitle className="text-sm font-semibold">Gửi bài viết qua tin nhắn</DialogTitle>
          <p className="text-xs text-muted-foreground truncate">{post.title || post.content.replace(/\s+/g, ' ').slice(0, 90)}</p>
        </div>

        <div className="px-4 space-y-2">
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((t) => (
                <button
                  key={keyOf(t)}
                  type="button"
                  onClick={() => toggle(t)}
                  className="flex max-w-40 items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 h-7 text-xs font-medium cursor-pointer"
                >
                  <span className="truncate">{t.label}</span>
                  <X className="h-3 w-3 shrink-0" />
                </button>
              ))}
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm người hoặc nhóm" className="pl-9 h-9 text-sm rounded-full" />
          </div>
        </div>

        <div className="mt-2 border-t border-border/60 h-72 overflow-y-auto py-1">
          {!searching && <p className="px-4 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Gần đây</p>}
          {loading ? (
            <UserListSkeleton count={4} className="px-2" label="Đang tải" />
          ) : !options.length ? (
            <p className="py-10 text-center text-xs text-muted-foreground">
              {searching ? 'Không tìm thấy người hoặc nhóm.' : 'Chưa có hội thoại — gõ tên để tìm người.'}
            </p>
          ) : (
            options.map((t) => {
              const on = isSelected(t)
              return (
                <button
                  key={keyOf(t)}
                  type="button"
                  onClick={() => toggle(t)}
                  className={cn('w-full flex items-center gap-3 px-4 py-2 text-left cursor-pointer hover:bg-muted/60', on && 'bg-primary/5')}
                >
                  {t.kind === 'conversation' ? (
                    <ConversationAvatar conversation={t.conversation} className="h-9 w-9" />
                  ) : (
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={t.user.avatarUrl || ''} />
                      <AvatarFallback className="text-[10px] font-bold">{t.user.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{t.label}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {t.kind === 'user' ? `@${t.user.username}` : t.conversation.type === 'group' ? `Nhóm · ${t.conversation.members.length + 1} người` : 'Tin nhắn'}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                      on ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                    )}
                  >
                    {on && <Check className="h-3 w-3" />}
                  </span>
                </button>
              )
            })
          )}
        </div>

        <div className="border-t border-border/60 p-3 space-y-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Viết lời nhắn (tùy chọn)" className="h-9 text-sm" />
          <Button onClick={submit} disabled={!selected.length || share.isPending} className="w-full h-10 rounded-full">
            {share.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {selected.length > 1 ? `Gửi tới ${selected.length} nơi` : 'Gửi'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
