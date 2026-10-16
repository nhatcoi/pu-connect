'use client'

import React from 'react'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { ArrowLeft, Library, Settings, SquarePen, type LucideIcon } from 'lucide-react'
import { AiThreadList } from '@/components/chat/ai/ai-thread-list'
import { PUAI_HOME, PUAI_LIBRARY, puaiSettingsHref } from '@/lib/puai-routes'
import { cn } from '@/lib/utils'
import { PuaiProfileMenu } from './puai-profile-menu'

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: PUAI_LIBRARY, label: 'Thư viện', icon: Library },
  { href: puaiSettingsHref(), label: 'Cài đặt', icon: Settings }
]

// Thanh bên không gian PU AI: chat mới · thư viện · cài đặt · lịch sử · hồ sơ PU AI (desktop cố định, mobile trong ngăn kéo)
export function PuaiSidebar() {
  const pathname = usePathname()
  const { id } = useParams<{ id?: string }>()
  const itemClass = (active: boolean) =>
    cn('flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors', active ? 'bg-primary/10 text-primary' : 'hover:bg-muted')

  return (
    <div className="flex h-full min-h-0 flex-col gap-1 p-3">
      <Link href="/" className="mb-1 flex items-center gap-1.5 px-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> PU Connector
      </Link>
      <Link href={PUAI_HOME} className={itemClass(pathname === PUAI_HOME)}>
        <SquarePen className="h-4 w-4" /> Chat mới
      </Link>
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className={itemClass(pathname.startsWith(href))}>
          <Icon className="h-4 w-4" /> {label}
        </Link>
      ))}
      <p className="px-2.5 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Lịch sử</p>
      <AiThreadList activeId={id} />
      <div className="mt-1 border-t border-border/60 pt-2">
        <PuaiProfileMenu />
      </div>
    </div>
  )
}
