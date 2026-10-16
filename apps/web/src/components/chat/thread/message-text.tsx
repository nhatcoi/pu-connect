'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { Telescope, Wand2 } from 'lucide-react'
import type { ChatMessageMeta } from '@pu/schemas'
import { PUAI_USERNAME } from '@/lib/mention'
import { cn } from '@/lib/utils'
import { REF_META, refHref } from '../refs'

// Cùng quy tắc ký tự đứng trước với server (bỏ qua email, URL)
const MENTION_RE = /(^|[^a-zA-Z0-9_@./])@([a-zA-Z0-9_]{3,30})(?![a-zA-Z0-9_])/g

// Nội dung tin văn bản: @tên có trong meta (đã được server xác nhận) thành link; mình được nhắc ⇒ nền vàng
export function MessageText({ content, meta, mine, myUsername }: { content: string; meta: ChatMessageMeta | null; mine: boolean; myUsername?: string }) {
  const parts = useMemo(() => {
    const known = new Set((meta?.mentions ?? []).map((m) => m.username.toLowerCase()))
    known.add(PUAI_USERNAME)
    if (meta?.mentionAll) known.add('all').add('everyone')
    const out: React.ReactNode[] = []
    let last = 0
    for (const match of content.matchAll(MENTION_RE)) {
      const username = match[2].toLowerCase()
      if (!known.has(username)) continue
      const at = match.index! + match[1].length
      out.push(content.slice(last, at))
      const isMe = username === myUsername?.toLowerCase() || ((username === 'all' || username === 'everyone') && !mine)
      const cls = cn(
        'rounded px-0.5 font-semibold',
        isMe ? 'bg-amber-200/70 text-amber-950 dark:bg-amber-400/30 dark:text-amber-100' : mine ? 'underline underline-offset-2' : 'text-primary'
      )
      out.push(
        username === 'all' || username === 'everyone' || username === PUAI_USERNAME ? (
          <span key={at} className={cls}>
            @{match[2]}
          </span>
        ) : (
          <Link key={at} href={`/${username}`} className={cn(cls, 'hover:underline')}>
            @{match[2]}
          </Link>
        )
      )
      last = at + match[2].length + 1
    }
    out.push(content.slice(last))
    return out
  }, [content, meta, mine, myUsername])

  return <div>{parts}</div>
}

// Nhãn skill / Research cạnh nhãn chế độ học
export function MessageAiBadges({ meta, mine }: { meta: ChatMessageMeta | null; mine: boolean }) {
  if (!meta?.skill && !meta?.research) return null
  const cls = cn(
    'mb-1 mr-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide',
    mine ? 'text-primary-foreground/80' : 'text-primary'
  )
  return (
    <>
      {meta.skill && (
        <span className={cls} title={meta.skill.name}>
          <Wand2 className="h-3 w-3" /> /{meta.skill.slug}
        </span>
      )}
      {meta.research && (
        <span className={cls}>
          <Telescope className="h-3 w-3" /> Research
        </span>
      )}
    </>
  )
}

// Ngữ cảnh đã gắn (dưới bong bóng)
export function MessageRefs({ meta, mine }: { meta: ChatMessageMeta | null; mine: boolean }) {
  if (!meta?.refs?.length) return null
  return (
    <div className={cn('flex flex-wrap gap-1 max-w-full', mine && 'justify-end')}>
      {meta.refs.map((r) => {
        const Icon = REF_META[r.type].icon
        return (
          <Link
            key={`${r.type}:${r.id}`}
            href={refHref(r)}
            title={`${REF_META[r.type].label}: ${r.title}`}
            className="inline-flex max-w-56 items-center gap-1 rounded-full bg-muted px-2 h-6 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Icon className="h-3 w-3 shrink-0" />
            <span className="truncate">{r.title}</span>
          </Link>
        )
      })}
    </div>
  )
}
