'use client'

import Link from 'next/link'
import { BookOpen, ExternalLink, FileText, Globe, Settings, Users } from 'lucide-react'
import type { ChatEmbed } from '@pu/schemas'
import { cn } from '@/lib/utils'

const KIND_ICON = { post: FileText, profile: Users, community: Users, course: BookOpen, page: Settings, link: Globe } as const

// Thẻ xem trước link trong tin: nội bộ ⇒ điều hướng trong app; link ngoài ⇒ mở tab mới (noopener)
// Link preview card under a chat bubble; fixed image ratio avoids layout shift
export function MessageEmbedCard({ embed, mine }: { embed: ChatEmbed; mine: boolean }) {
  const Icon = KIND_ICON[embed.kind]
  const external = embed.kind === 'link'
  const cardClass = cn(
    'block w-72 max-w-full overflow-hidden rounded-2xl border border-border bg-card text-left text-card-foreground transition-colors hover:bg-muted/40',
    mine ? 'self-end' : 'self-start'
  )
  const body = (
    <>
      {embed.image && (
        // Khung tỉ lệ cố định; ảnh ngoài không gửi Referer
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={embed.image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className={cn('w-full bg-muted object-cover', embed.kind === 'profile' ? 'mx-3 mt-3 h-12 w-12 rounded-full' : 'aspect-[1.91/1]')}
        />
      )}
      <div className="space-y-1 p-3">
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Icon className="h-3 w-3 shrink-0" />
          <span className="truncate">{embed.siteName}</span>
          {external && <ExternalLink className="ml-auto h-3 w-3 shrink-0" />}
        </p>
        <p className="text-sm font-semibold leading-snug line-clamp-2">{embed.title}</p>
        {embed.description && <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">{embed.description}</p>}
      </div>
    </>
  )
  return external ? (
    <a href={embed.url} target="_blank" rel="noopener noreferrer nofollow" className={cardClass}>
      {body}
    </a>
  ) : (
    <Link href={embed.url} className={cardClass}>
      {body}
    </Link>
  )
}
