'use client'

import React from 'react'
import Link from 'next/link'
import { Pin, PinOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCommunityPinActions, useCommunityPins } from '@/hooks/use-community-extras'
import { formatRelativeTime } from '@/lib/utils'

// Dải "Đã ghim" đầu cộng đồng: tối đa 3 bài, chủ / điều hành viên bỏ ghim được
export function CommunityPins({ slug, canManage }: { slug: string; canManage: boolean }) {
  const { data: pins } = useCommunityPins(slug)
  const { unpin } = useCommunityPinActions(slug)
  if (!pins?.length) return null
  return (
    <div className="mx-2 sm:mx-0 mb-2.5 rounded-xl bg-card p-3 sm:p-4 space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <Pin className="h-3.5 w-3.5" />
        Đã ghim
      </div>
      {pins.map((p) => (
        <div key={p.id} className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50">
          <Link href={`/post/${p.id}`} className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{p.title || p.snippet}</p>
            <p className="truncate text-xs text-muted-foreground">
              {p.authorName} · {formatRelativeTime(p.createdAt)}
              {p.title ? ` · ${p.snippet}` : ''}
            </p>
          </Link>
          {canManage && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 rounded-full text-muted-foreground hover:text-destructive"
              title="Bỏ ghim"
              aria-label="Bỏ ghim"
              disabled={unpin.isPending}
              onClick={() => unpin.mutate(p.id)}
            >
              <PinOff className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}

// Nút ghim trên bài (chủ / điều hành viên); đặt cạnh nút ẩn bài
export function PinPostButton({ slug, postId }: { slug: string; postId: string }) {
  const { data: pins } = useCommunityPins(slug)
  const { pin, unpin } = useCommunityPinActions(slug)
  const pinned = !!pins?.some((p) => p.id === postId)
  return (
    <Button
      variant="ghost"
      size="icon"
      className="absolute right-[5.25rem] top-2.5 z-10 h-7 w-7 rounded-full text-muted-foreground hover:text-primary"
      title={pinned ? 'Bỏ ghim' : 'Ghim bài'}
      aria-label={pinned ? 'Bỏ ghim' : 'Ghim bài'}
      disabled={pin.isPending || unpin.isPending}
      onClick={() => (pinned ? unpin.mutate(postId) : pin.mutate(postId))}
    >
      {pinned ? <PinOff className="h-3.5 w-3.5 text-primary" /> : <Pin className="h-3.5 w-3.5" />}
    </Button>
  )
}
