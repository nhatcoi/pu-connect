'use client'

import React from 'react'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { ArrowLeft, Ghost, Library, PanelLeftClose, Settings, Sparkles, SquarePen, type LucideIcon } from 'lucide-react'
import { AiThreadList } from '@/components/chat/ai/ai-thread-list'
import { N7AI_HOME, N7AI_LIBRARY, N7AI_TEMPORARY, n7aiSettingsHref } from '@/lib/n7ai-routes'
import { cn } from '@/lib/utils'
import { useN7AiLayout } from './layout/n7ai-layout-store'
import { N7AiProfileMenu } from './n7ai-profile-menu'

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: N7AI_TEMPORARY, label: 'Chat tạm', icon: Ghost },
  { href: N7AI_LIBRARY, label: 'Thư viện', icon: Library },
  { href: n7aiSettingsHref(), label: 'Cài đặt', icon: Settings }
]

// Thanh bên không gian N7AI: chat mới · thư viện · cài đặt · thư mục + lịch sử · hồ sơ N7AI (desktop cố định, mobile trong ngăn kéo)
export function N7AiSidebar() {
  const pathname = usePathname()
  const { id } = useParams<{ id?: string }>()
  const toggleSidebar = useN7AiLayout((s) => s.toggleSidebar)
  const itemClass = (active: boolean) =>
    cn('flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors', active ? 'bg-primary/10 text-primary' : 'hover:bg-muted')

  return (
    <div className="flex h-full min-h-0 flex-col gap-1 p-3">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>N7AI Studio</span>
        </span>
        <Link href="/" className="flex md:hidden items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> PU Connector
        </Link>
        <button
          type="button"
          onClick={toggleSidebar}
          title="Thu gọn thanh bên (Ctrl/⌘ B)"
          aria-label="Thu gọn thanh bên"
          className="hidden h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground md:flex"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>
      <Link href={N7AI_HOME} className={itemClass(pathname === N7AI_HOME)}>
        <SquarePen className="h-4 w-4" /> Chat mới
      </Link>
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className={itemClass(pathname.startsWith(href))}>
          <Icon className="h-4 w-4" /> {label}
        </Link>
      ))}
      <div className="flex min-h-0 flex-1 flex-col pt-3">
        <AiThreadList activeId={id} />
      </div>
      <div className="mt-1 border-t border-border/60 pt-2">
        <N7AiProfileMenu />
      </div>
    </div>
  )
}
