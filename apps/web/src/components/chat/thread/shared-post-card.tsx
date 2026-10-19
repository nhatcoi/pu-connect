'use client'

import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import type { ChatSharedPost } from '@pu/schemas'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

// Thẻ bài viết được chia sẻ trong tin nhắn (ảnh chụp lúc gửi; bấm ⇒ mở bài)
// Shared post preview inside a chat bubble
export function SharedPostCard({ post, mine }: { post: ChatSharedPost; mine: boolean }) {
  return (
    <Link
      href={`/post/${post.id}`}
      className={cn(
        'block w-72 max-w-full overflow-hidden rounded-2xl border border-border bg-card text-left transition-colors hover:bg-muted/40',
        mine ? 'self-end' : 'self-start'
      )}
    >
      {post.image && (
        // Khung tỉ lệ cố định ⇒ không giật layout khi ảnh tải xong
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.image} alt="" loading="lazy" className="aspect-[1.91/1] w-full object-cover bg-muted" />
      )}
      <div className="space-y-1.5 p-3">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="h-5 w-5">
            <AvatarImage src={post.author.avatarUrl || ''} />
            <AvatarFallback className="text-[8px] font-bold">{post.author.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium truncate">{post.author.displayName}</span>
          <span className="text-[11px] text-muted-foreground truncate">@{post.author.username}</span>
        </div>
        {post.title && <p className="text-sm font-semibold leading-snug line-clamp-2">{post.title}</p>}
        {post.excerpt && <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{post.excerpt}</p>}
        <p className="flex items-center gap-1 pt-0.5 text-[11px] font-medium text-primary">
          <MessageSquare className="h-3 w-3" /> Xem bài viết
        </p>
      </div>
    </Link>
  )
}
