'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { PUAI_SETTINGS_ITEMS, type PuaiSettingsItem } from '@/lib/puai-settings-registry'

const GROUPS: { id: PuaiSettingsItem['group']; label: string }[] = [
  { id: 'capabilities', label: 'Năng lực' },
  { id: 'support', label: 'Hỗ trợ & pháp lý' }
]

// Cài đặt › PU AI: danh sách mục chia 2 nhóm (giống app di động)
export function PuaiMenu() {
  return (
    <div className="space-y-3 px-3 pb-4 sm:px-4">
      {GROUPS.map((g) => (
        <section key={g.id}>
          <h2 className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</h2>
          <nav aria-label={g.label} className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60">
            {PUAI_SETTINGS_ITEMS.filter((i) => i.group === g.id).map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.id}
                  href={item.href ?? `/settings/puai/${item.id}`}
                  className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <Icon className="h-[18px] w-[18px] shrink-0 text-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold">{item.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )
            })}
          </nav>
        </section>
      ))}
    </div>
  )
}
