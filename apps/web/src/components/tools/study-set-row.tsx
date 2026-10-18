import React from 'react'
import Link from 'next/link'
import type { StudySetSummary } from '@pu/schemas'
import { N7AiMark } from '@/components/brand/pu-logo'
import { formatRelativeTime } from '@/lib/utils'
import { TOOL_META, toolHref } from './tool-catalog'

// 1 bộ trong danh sách: icon loại · tên (✦ nếu N7AI tạo) · số mục · đến hạn / điểm cao nhất
export function StudySetRow({ set, showKind = false }: { set: StudySetSummary; showKind?: boolean }) {
  const meta = TOOL_META[set.kind]
  const Icon = meta.icon
  const stat =
    set.kind === 'flashcards'
      ? set.dueCount > 0
        ? `${set.dueCount} thẻ cần ôn`
        : 'Đã ôn xong'
      : set.bestScore != null
        ? `Cao nhất ${set.bestScore}%`
        : 'Chưa làm'
  return (
    <Link href={toolHref(set.kind, set.id)} className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 hover:bg-muted/40 transition-colors">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{set.title}</span>
          {set.source === 'n7ai' && <N7AiMark className="h-3.5 w-3.5 shrink-0" />}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {showKind && `${meta.label} · `}
          {set.itemCount} {meta.itemLabel} · {formatRelativeTime(set.lastStudiedAt ?? set.updatedAt)}
        </span>
      </span>
      <span
        className={
          set.kind === 'flashcards' && set.dueCount > 0
            ? 'shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400'
            : 'shrink-0 text-[11px] text-muted-foreground'
        }
      >
        {stat}
      </span>
    </Link>
  )
}
