'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Library, Settings, SquarePen, type LucideIcon } from 'lucide-react'
import { N7AiMark } from '@/components/brand/pu-logo'
import { N7AI_HOME, N7AI_LIBRARY, n7aiSettingsHref } from '@/lib/n7ai-routes'
import { cn } from '@/lib/utils'
import { useN7AiLayout } from './n7ai-layout-store'

const ITEMS: { href: string; label: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: N7AI_HOME, label: 'Chat mới', icon: SquarePen, exact: true },
  { href: N7AI_LIBRARY, label: 'Thư viện', icon: Library },
  { href: n7aiSettingsHref(), label: 'Cài đặt', icon: Settings }
]

const railButton = 'flex h-9 w-9 items-center justify-center rounded-lg transition-colors'

// Thanh bên thu gọn: chỉ icon (Ctrl/⌘ + B để mở lại)
export function N7AiRail() {
  const pathname = usePathname()
  const toggleSidebar = useN7AiLayout((s) => s.toggleSidebar)
  return (
    <nav aria-label="N7AI" className="flex h-full flex-col items-center gap-1 py-3">
      <button
        type="button"
        onClick={toggleSidebar}
        title="Mở thanh bên (Ctrl/⌘ B)"
        aria-label="Mở thanh bên"
        className={cn(railButton, 'mb-2 cursor-pointer text-muted-foreground hover:bg-muted hover:text-foreground')}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      {ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            title={label}
            aria-label={label}
            className={cn(railButton, active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
          >
            <Icon className="h-4 w-4" />
          </Link>
        )
      })}
      <Link href={n7aiSettingsHref()} title="N7AI" aria-label="Cài đặt N7AI" className="mt-auto">
        <N7AiMark className="h-7 w-7" />
      </Link>
    </nav>
  )
}
