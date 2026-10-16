'use client'

import React, { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SettingsGroup } from './settings-ui'

const THEMES = [
  { id: 'light', label: 'Sáng', icon: Sun },
  { id: 'dark', label: 'Tối', icon: Moon },
  { id: 'system', label: 'Theo hệ thống', icon: Monitor }
] as const

// Khung xem trước thu nhỏ của 1 giao diện (sáng / tối / nửa-nửa)
function ThemePreview({ mode }: { mode: (typeof THEMES)[number]['id'] }) {
  const pane = (dark: boolean) => (
    <div className={cn('flex h-full flex-1 flex-col gap-1 p-1.5', dark ? 'bg-zinc-900' : 'bg-zinc-50')}>
      <div className={cn('h-1.5 w-2/3 rounded-full', dark ? 'bg-zinc-600' : 'bg-zinc-300')} />
      <div className={cn('flex-1 rounded', dark ? 'bg-zinc-800' : 'bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06)]')} />
      <div className="h-1.5 w-1/3 rounded-full bg-primary/70" />
    </div>
  )
  return (
    <div className="flex h-16 overflow-hidden rounded-lg">
      {mode === 'system' ? (
        <>
          {pane(false)}
          {pane(true)}
        </>
      ) : (
        pane(mode === 'dark')
      )}
    </div>
  )
}

// Giao diện: lưu trên trình duyệt (next-themes), áp dụng ngay
export function AppearanceSection() {
  const { theme, setTheme } = useTheme()
  // Tránh lệch SSR: chỉ biết theme sau khi mount
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const current = mounted ? theme ?? 'system' : null

  return (
    <SettingsGroup label="Chủ đề" hint="Lưu trên trình duyệt này.">
      <div role="radiogroup" aria-label="Chủ đề giao diện" className="grid grid-cols-3 gap-2.5 py-3">
        {THEMES.map(({ id, label, icon: Icon }) => {
          const selected = current === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(id)}
              className={cn(
                'relative rounded-xl p-1.5 text-left ring-1 transition-[box-shadow,background-color] cursor-pointer',
                selected ? 'bg-primary/[0.04] ring-2 ring-primary' : 'ring-border hover:ring-foreground/25'
              )}
            >
              <ThemePreview mode={id} />
              <span className="flex items-center gap-1.5 px-1 pt-2 pb-0.5 text-xs font-medium">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate">{label}</span>
              </span>
              {selected && (
                <span className="absolute top-2.5 right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </SettingsGroup>
  )
}
