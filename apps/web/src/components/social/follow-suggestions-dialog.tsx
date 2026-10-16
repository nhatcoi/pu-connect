'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import type { FollowSuggestion } from '@pu/schemas'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FollowButton } from '@/components/profile/follow-button'
import { UserListSkeleton } from '@/components/skeletons/user-row-skeleton'
import { prefetchProfile } from '@/hooks/use-profile'
import { suggestionReasonText, useExploreSuggestions } from '@/hooks/use-follow-suggestions'
import { queryKeys } from '@/lib/query-keys'

interface FollowSuggestionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Modal "Khám phá thêm": gợi ý theo dõi đã xếp hạng, theo dõi ngay trong danh sách
export function FollowSuggestionsDialog({ open, onOpenChange }: FollowSuggestionsDialogProps) {
  const queryClient = useQueryClient()
  const { data = [], isPending, isFetching, refetch } = useExploreSuggestions(open)
  const [followed, setFollowed] = useState<Set<string>>(new Set())

  const toggle = (id: string, isFollowing: boolean) =>
    setFollowed((prev) => {
      const next = new Set(prev)
      if (isFollowing) next.add(id)
      else next.delete(id)
      return next
    })

  // Đóng modal: có theo dõi mới ⇒ tải lại tab "Đang theo dõi" để thấy bài của họ
  const handleOpenChange = (next: boolean) => {
    if (!next && followed.size > 0) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.feed('following') })
      setFollowed(new Set())
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-md flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-5 pt-5 pb-4 text-left">
          <DialogTitle className="text-base">Khám phá thêm</DialogTitle>
          <DialogDescription className="text-xs">Gợi ý dựa trên người bạn theo dõi, lớp, khoa và sở thích chung.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {isPending ? (
            <UserListSkeleton count={6} action avatarClassName="h-10 w-10" rowClassName="px-3 py-2.5" label="Đang tải gợi ý" />
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <Users className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium">Bạn đã theo dõi hết mọi người</p>
              <p className="mt-1 text-xs text-muted-foreground">Quay lại sau khi có thêm thành viên mới nhé.</p>
            </div>
          ) : (
            <ul>
              {data.map((s) => (
                <SuggestionRow key={s.id} suggestion={s} onFollowChange={(v) => toggle(s.id, v)} />
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/60 px-5 py-3">
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={isFetching ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            Làm mới
          </button>
          <div className="flex items-center gap-3">
            {followed.size > 0 && (
              <span className="text-xs text-muted-foreground" aria-live="polite">
                Đã theo dõi {followed.size} người
              </span>
            )}
            <Button size="sm" className="h-8 rounded-full px-4 text-xs font-semibold" onClick={() => handleOpenChange(false)}>
              Xong
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SuggestionRow({ suggestion: s, onFollowChange }: { suggestion: FollowSuggestion; onFollowChange: (isFollowing: boolean) => void }) {
  const queryClient = useQueryClient()
  const showMutualAvatars = s.reason === 'mutual' && s.mutuals.length > 0

  return (
    <li className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/40">
      <Link href={`/${s.username}`} onMouseEnter={() => prefetchProfile(queryClient, s.username)} className="flex min-w-0 flex-1 items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={s.avatarUrl || ''} alt="" />
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{s.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1">
            <span className="truncate text-[13px] font-semibold hover:underline">{s.displayName}</span>
            {s.isVerified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-blue-500" />}
            {s.role === 'lecturer' && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Giảng viên" />}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            @{s.username}
            {s.faculty && <> · {s.faculty}</>}
          </span>
          {s.bio && <span className="mt-1 line-clamp-1 text-xs text-foreground/80">{s.bio}</span>}
          <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {showMutualAvatars && (
              <span className="flex -space-x-1.5">
                {s.mutuals.slice(0, 3).map((m) => (
                  <Avatar key={m.username} className="h-4 w-4 ring-2 ring-background">
                    <AvatarImage src={m.avatarUrl || ''} alt="" />
                    <AvatarFallback className="text-[7px]">{m.displayName.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                ))}
              </span>
            )}
            <span className="truncate">{suggestionReasonText(s)}</span>
          </span>
        </span>
      </Link>
      <FollowButton
        targetUserId={s.id}
        targetUsername={s.username}
        initialIsFollowing={false}
        onFollowChange={onFollowChange}
        size="sm"
        showIcon={false}
        className="mt-0.5 h-8 min-w-[104px] shrink-0 rounded-full px-3 text-xs"
      />
    </li>
  )
}
