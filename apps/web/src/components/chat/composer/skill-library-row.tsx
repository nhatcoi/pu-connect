'use client'

import React from 'react'
import Link from 'next/link'
import { BadgeCheck, Check, Download } from 'lucide-react'
import type { AiPublicSkill } from '@pu/schemas'
import { Button } from '@/components/ui/button'

// 1 skill công khai: Tên ✓ (chính thức) / @tác giả · /lệnh · mô tả · lượt cài (ẩn khi 0) · nút Cài
export function SkillLibraryRow({ skill: s, installing, onInstall }: { skill: AiPublicSkill; installing: boolean; onInstall: () => void }) {
  return (
    <li className="flex items-center gap-2 px-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-sm">
          <span className="truncate font-medium">{s.name}</span>
          {s.official ? (
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Chính thức" />
          ) : (
            <Link href={`/${s.author.username}`} className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground hover:underline">
              @{s.author.username}
            </Link>
          )}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          /{s.slug}
          {s.description && ` · ${s.description}`}
        </span>
      </span>
      {s.installCount > 0 && (
        <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-muted-foreground" title={`${s.installCount} lượt cài`}>
          <Download className="h-3 w-3" />
          {s.installCount}
        </span>
      )}
      <Button
        size="sm"
        variant={s.installed ? 'secondary' : 'outline'}
        className="h-7 shrink-0 rounded-full text-xs gap-1"
        disabled={s.installed || installing}
        onClick={onInstall}
      >
        {s.installed ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
        {s.installed ? 'Đã cài' : 'Cài'}
      </Button>
    </li>
  )
}
