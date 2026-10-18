'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowUpRight, Check, Loader2, UsersRound } from 'lucide-react'
import type { AiAction } from '@pu/schemas'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useJoinStudyGroup } from '@/hooks/use-join-study-group'

const LINK_CLASS = cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-9 max-w-full rounded-full text-xs')

// Nút dưới câu trả lời N7AI: mở trang trong app / hành động cần chính người dùng bấm xác nhận (N7AI không tự làm)
export function AiActions({ actions }: { actions: AiAction[] }) {
  return (
    <div className="not-prose mt-2 flex flex-wrap gap-1.5" aria-label="Gợi ý thao tác">
      {actions.map((a) =>
        a.kind === 'link' ? (
          <Link key={a.href} href={a.href} className={LINK_CLASS}>
            <span className="truncate">{a.label}</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
          </Link>
        ) : (
          <JoinGroupAction key={a.id} action={a} />
        )
      )}
    </div>
  )
}

function JoinGroupAction({ action }: { action: Extract<AiAction, { kind: 'join_group' }> }) {
  const join = useJoinStudyGroup()
  if (join.isSuccess) {
    return (
      <Link href={action.href} className={LINK_CLASS}>
        <Check className="h-3.5 w-3.5 text-primary" />
        <span className="truncate">Đã tham gia · Xem nhóm</span>
      </Link>
    )
  }
  return (
    <Button size="sm" className="h-9 max-w-full rounded-full text-xs" disabled={join.isPending} onClick={() => join.mutate(action.id)}>
      {join.isPending ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <UsersRound className="h-3.5 w-3.5 shrink-0" />}
      <span className="truncate">{action.label}</span>
    </Button>
  )
}
