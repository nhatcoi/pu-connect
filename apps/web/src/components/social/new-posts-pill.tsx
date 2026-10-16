'use client'

import React from 'react'
import { ArrowUp, Loader2 } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { NewPostsAuthor } from '@/hooks/use-new-posts'

interface NewPostsPillProps {
  count: number
  authors: NewPostsAuthor[]
  isRevealing?: boolean
  onClick: () => void
}

// Pill "bài mới" nổi dưới thanh tab; wrapper cao 0 ⇒ không đẩy layout (Zero CLS)
export function NewPostsPill({ count, authors, isRevealing, onClick }: NewPostsPillProps) {
  const visible = count > 0

  return (
    <div className="pointer-events-none sticky top-14 md:top-28 z-20 h-0" aria-live="polite">
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onClick}
          disabled={!visible || isRevealing}
          tabIndex={visible ? 0 : -1}
          aria-hidden={!visible}
          className={cn(
            'mt-2 flex items-center gap-2 rounded-full bg-primary py-1.5 pl-2.5 pr-3.5 text-xs font-semibold text-primary-foreground shadow-lg transition-all duration-200 cursor-pointer',
            visible ? 'pointer-events-auto translate-y-0 opacity-100' : '-translate-y-3 opacity-0'
          )}
          title={`Xem ${count} bài viết mới`}
        >
          {isRevealing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          {authors.length > 0 && (
            <span className="flex -space-x-2">
              {authors.map((a) => (
                <Avatar key={a.id} className="h-6 w-6 border-2 border-primary">
                  <AvatarImage src={a.avatarUrl || ''} alt={a.displayName} />
                  <AvatarFallback className="bg-muted text-foreground text-[9px] font-bold">
                    {(a.displayName || a.username).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
            </span>
          )}
          <span>{count >= 50 ? '50+' : count} bài mới</span>
        </button>
      </div>
    </div>
  )
}
