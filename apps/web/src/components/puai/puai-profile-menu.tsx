'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { ChevronsUpDown, Settings } from 'lucide-react'
import { N7AiMark } from '@/components/brand/pu-logo'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAiQuota } from '@/hooks/chat'
import { puaiSettingsHref } from '@/lib/puai-routes'
import { PUAI_SETTINGS_ITEMS } from '@/lib/puai-settings-registry'

// Lối tắt hay dùng trong menu hồ sơ (đủ mục ở "Tất cả cài đặt")
const SHORTCUTS = ['skills', 'connectors', 'memory', 'tasks']

// Hồ sơ PU AI (đáy thanh bên): lượt còn lại + menu tới cài đặt PU AI
export function PuaiProfileMenu() {
  const router = useRouter()
  const { data: quota } = useAiQuota()
  const items = PUAI_SETTINGS_ITEMS.filter((i) => SHORTCUTS.includes(i.id))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-muted cursor-pointer data-[state=open]:bg-muted">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card">
            <N7AiMark className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold">PU AI</span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {quota ? `Còn ${Math.max(0, quota.limit - quota.used)}/${quota.limit} lượt hôm nay` : 'Trợ lý học tập'}
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <DropdownMenuItem key={item.id} onSelect={() => router.push(puaiSettingsHref(item.id))}>
              <Icon /> {item.label}
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push(puaiSettingsHref())}>
          <Settings /> Tất cả cài đặt PU AI
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
