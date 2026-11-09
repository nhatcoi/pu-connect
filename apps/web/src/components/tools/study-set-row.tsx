import React from 'react'
import Link from 'next/link'
import type { StudySetSummary } from '@pu/schemas'
import { N7AiMark } from '@/components/brand/pu-logo'
import { cn, formatRelativeTime } from '@/lib/utils'
import { TOOL_META, toolHref } from './tool-catalog'

// Điểm quiz → màu: ≥80 tốt, ≥50 trung bình, còn lại cần ôn lại
const scoreTone = (n: number) => (n >= 80 ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : n >= 50 ? 'text-amber-700 dark:text-amber-400 bg-amber-500/10' : 'text-rose-600 dark:text-rose-400 bg-rose-500/10')

function Status({ set }: { set: StudySetSummary }) {
  if (set.kind === 'flashcards') {
    return set.dueCount > 0 ? (
      <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">{set.dueCount} thẻ cần ôn</span>
    ) : (
      <span className="shrink-0 text-[11px] text-muted-foreground">Đã ôn xong</span>
    )
  }
  return set.bestScore != null ? (
    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums', scoreTone(set.bestScore))}>{set.bestScore}%</span>
  ) : (
    <span className="shrink-0 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground">Chưa làm</span>
  )
}

// 1 bộ trong danh sách: icon loại · tên (✦ nếu N7AI tạo) · số mục · trạng thái (thẻ cần ôn / điểm cao nhất)
// flat: nằm trong khung danh sách chung (không nền / bo riêng)
export function StudySetRow({ set, showKind = false, flat = false }: { set: StudySetSummary; showKind?: boolean; flat?: boolean }) {
  const meta = TOOL_META[set.kind]
  const Icon = meta.icon
  return (
    <Link
      href={toolHref(set.kind, set.id)}
      className={cn('flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40', !flat && 'rounded-xl bg-card')}
    >
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
      <Status set={set} />
    </Link>
  )
}
