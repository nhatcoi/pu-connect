'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Bell, BellOff, Check, LogOut, Maximize2, Pencil, Pin, PinOff, Settings, X } from 'lucide-react'
import type { ConversationSummary } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { chatApi, conversationTitle, useConversationActions } from '@/hooks/chat'
import { puaiSettingsHref, puaiThreadHref } from '@/lib/puai-routes'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { ConversationAvatar } from '../conversation-avatar'
import { messagePreview } from '../utils'
import { GroupAvatarEditor } from './group-avatar-editor'
import { MediaPanel } from './media-panel'
import { MemberList } from './member-list'
import { MessageSearch } from './message-search'

type Tab = 'members' | 'image' | 'file' | 'pinned'

const MUTE_OPTIONS = [
  { hours: 1, label: 'Trong 1 giờ' },
  { hours: 8, label: 'Trong 8 giờ' },
  { hours: 24, label: 'Trong 24 giờ' },
  { hours: -1, label: 'Cho đến khi bật lại' }
]

// Bảng thông tin DM / nhóm / PU AI chat nhanh (cột phải trên desktop, hộp thoại trên mobile)
export function ConversationInfo({ conversation: c, onJump }: { conversation: ConversationSummary; onJump: (id: string) => void }) {
  const router = useRouter()
  const isGroup = c.type === 'group'
  const isAi = c.type === 'ai'
  // DM mở tab "Đã ghim" (dùng lại cache của thanh tin ghim) ⇒ ảnh/tệp chỉ tải khi bấm tab
  const [tab, setTab] = useState<Tab>(isGroup ? 'members' : 'pinned')
  const [renaming, setRenaming] = useState(false)
  const [title, setTitle] = useState(c.title ?? '')
  const { settings, rename, leave } = useConversationActions(c.id)
  const other = c.type === 'direct' ? c.members[0] : null

  const tabs: { id: Tab; label: string }[] = [
    ...(isGroup ? [{ id: 'members' as const, label: 'Thành viên' }] : []),
    { id: 'image', label: 'Ảnh' },
    { id: 'file', label: 'Tệp' },
    { id: 'pinned', label: 'Đã ghim' }
  ]

  return (
    <div className="rounded-2xl bg-card p-4 space-y-4">
      <div className="flex flex-col items-center text-center gap-2">
        {isGroup ? <GroupAvatarEditor conversation={c} /> : <ConversationAvatar conversation={c} className="h-16 w-16" />}
        {renaming ? (
          <form
            className="flex items-center gap-1 w-full"
            onSubmit={(e) => {
              e.preventDefault()
              if (title.trim()) rename.mutate(title.trim(), { onSuccess: () => setRenaming(false) })
            }}
          >
            <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} className="h-8 text-sm" />
            <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={rename.isPending} aria-label="Lưu">
              <Check className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setRenaming(false)} aria-label="Hủy">
              <X className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <div className="flex items-center gap-1 max-w-full">
            <p className="text-[15px] font-semibold truncate">{conversationTitle(c)}</p>
            {isGroup && (
              <button onClick={() => setRenaming(true)} className="p-1 text-muted-foreground hover:text-foreground cursor-pointer" aria-label="Đổi tên nhóm">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground -mt-1">
          {isGroup ? (
            `${c.studyGroupId ? 'Nhóm học' : 'Nhóm'} · ${c.memberCount} thành viên`
          ) : isAi ? (
            <Link href="/puai" className="hover:underline">
              @puai · Trợ lý học tập
            </Link>
          ) : (
            other && (
              <Link href={`/${other.username}`} className="hover:underline">
                @{other.username}
              </Link>
            )
          )}
        </p>
      </div>

      {/* PU AI luôn đứng đầu & không tính badge ⇒ thay tắt tiếng / ghim bằng lối vào không gian /puai */}
      {isAi ? (
        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="outline" size="sm" className="h-9 rounded-xl gap-1.5 text-xs">
            <Link href={puaiThreadHref(c.id)}>
              <Maximize2 className="h-3.5 w-3.5" /> Mở trong PU AI
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-9 rounded-xl gap-1.5 text-xs">
            <Link href={puaiSettingsHref()}>
              <Settings className="h-3.5 w-3.5" /> Cài đặt PU AI
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 rounded-xl gap-1.5 text-xs">
                {c.mutedUntil ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                {c.mutedUntil ? 'Đang tắt' : 'Tắt thông báo'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48 p-1 rounded-xl">
              {c.mutedUntil ? (
                <DropdownMenuItem className="text-xs px-3 py-2 rounded-lg cursor-pointer" onClick={() => settings.mutate({ mutedHours: 0 })}>
                  Bật lại thông báo
                </DropdownMenuItem>
              ) : (
                MUTE_OPTIONS.map((o) => (
                  <DropdownMenuItem
                    key={o.hours}
                    className="text-xs px-3 py-2 rounded-lg cursor-pointer"
                    onClick={() => settings.mutate({ mutedHours: o.hours })}
                  >
                    {o.label}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" className="h-9 rounded-xl gap-1.5 text-xs" onClick={() => settings.mutate({ pinned: !c.pinnedAt })}>
            {c.pinnedAt ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            {c.pinnedAt ? 'Bỏ ghim' : 'Ghim lên đầu'}
          </Button>
        </div>
      )}

      <MessageSearch conversationId={c.id} onJump={onJump} />

      <div>
        <div className="flex gap-1 border-b mb-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-2.5 pb-2 text-xs font-medium border-b-2 -mb-px cursor-pointer',
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'members' && isGroup && <MemberList conversation={c} />}
        {(tab === 'image' || tab === 'file') && <MediaPanel conversationId={c.id} kind={tab} />}
        {tab === 'pinned' && <PinnedList conversationId={c.id} onJump={onJump} />}
      </div>

      {isGroup && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-9 rounded-xl gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
          disabled={leave.isPending}
          onClick={() => {
            if (window.confirm('Rời nhóm này? Bạn sẽ không nhận tin nhắn mới nữa.')) leave.mutate(undefined, { onSuccess: () => router.push('/messages') })
          }}
        >
          <LogOut className="h-3.5 w-3.5" /> Rời nhóm
        </Button>
      )}
    </div>
  )
}

function PinnedList({ conversationId, onJump }: { conversationId: string; onJump: (id: string) => void }) {
  const { data = [] } = useQuery({ queryKey: queryKeys.chatPinned(conversationId), queryFn: () => chatApi.pinned(conversationId), staleTime: 60 * 1000 })
  if (!data.length) return <p className="py-6 text-center text-xs text-muted-foreground">Chưa ghim tin nào. Di chuột vào tin ⇒ ⋯ ⇒ Ghim tin.</p>
  return (
    <div className="space-y-0.5">
      {data.map((m) => (
        <button key={m.id} onClick={() => onJump(m.id)} className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-muted/60 cursor-pointer">
          <span className="block text-[11px] font-medium text-muted-foreground truncate">{m.sender?.displayName}</span>
          <span className="block text-xs line-clamp-2">{messagePreview(m)}</span>
        </button>
      ))}
    </div>
  )
}
