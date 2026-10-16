'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { SETTINGS_SECTIONS, type SettingsSectionId } from '@/lib/settings-registry'
import { cn } from '@/lib/utils'

// Tiêu đề trang con: nút quay lại danh sách + tên mục
export function SettingsHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex items-start gap-2 px-2 pt-3 pb-2 sm:px-3">
      <Link
        href="/settings"
        aria-label="Quay lại Cài đặt"
        className="mt-0.5 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div className="min-w-0 pt-1">
        <h1 className="text-lg font-bold leading-tight">{title}</h1>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
  )
}

// Nhóm cài đặt: nhãn nhỏ + danh sách dòng ngăn bằng đường kẻ
export function SettingsGroup({
  label,
  hint,
  children
}: {
  label?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="px-4 py-3 sm:px-5">
      {label && <h2 className="pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</h2>}
      <div className="divide-y divide-border/60">{children}</div>
      {hint && <p className="pt-2 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
    </section>
  )
}

// 1 dòng cài đặt: nhãn + mô tả bên trái, điều khiển bên phải
export function SettingRow({
  label,
  description,
  htmlFor,
  children
}: {
  label: React.ReactNode
  description?: React.ReactNode
  htmlFor?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <label htmlFor={htmlFor} className={cn('min-w-0 flex-1', htmlFor && 'cursor-pointer')}>
        <span className="block text-[13px] font-medium text-foreground">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{description}</span>}
      </label>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  )
}

// Dòng có công tắc (lưu ngay khi bấm)
export function SwitchRow({
  id,
  label,
  description,
  checked,
  onCheckedChange
}: {
  id: string
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <SettingRow label={label} description={description} htmlFor={id}>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </SettingRow>
  )
}

// Danh sách mục cài đặt: full (trang /settings) hoặc compact (cột phải desktop)
export function SettingsNav({ active, compact = false }: { active?: SettingsSectionId; compact?: boolean }) {
  return (
    <nav aria-label="Mục cài đặt" className={cn(compact ? 'space-y-0.5 p-1.5' : 'divide-y divide-border/60')}>
      {SETTINGS_SECTIONS.map((s) => {
        const Icon = s.icon
        const isActive = s.id === active
        return (
          <Link
            key={s.id}
            href={`/settings/${s.id}`}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'group flex items-center gap-3 transition-colors',
              compact
                ? cn(
                    'rounded-lg px-3 py-2 text-[13px] font-medium',
                    isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  )
                : 'px-4 py-3.5 hover:bg-muted/40 sm:px-5'
            )}
          >
            <span
              className={cn(
                'flex shrink-0 items-center justify-center',
                !compact && 'h-9 w-9 rounded-full bg-muted/70 text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary'
              )}
            >
              <Icon className={compact ? 'h-4 w-4' : 'h-[18px] w-[18px]'} />
            </span>
            {compact ? (
              <span className="truncate">{s.label}</span>
            ) : (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-foreground">{s.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{s.description}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
