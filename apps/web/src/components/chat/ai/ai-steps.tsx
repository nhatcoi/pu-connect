'use client'

import React, { useState } from 'react'
import { AlertCircle, Check, ChevronDown, Layers, Loader2 } from 'lucide-react'
import type { AiStep } from '@pu/schemas'
import { ConnectorIcon } from '@/components/n7ai/connector-icon'
import { cn } from '@/lib/utils'

// Logo Google (ConnectorIcon) hoặc biểu tượng nguồn nội bộ
function StepIcon({ provider }: { provider: AiStep['provider'] }) {
  if (provider === 'my_study') return <Layers className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
  return <ConnectorIcon id={provider} className="h-3.5 w-3.5" />
}

function StepRow({ step: s }: { step: AiStep }) {
  return (
    <li className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
      <StepIcon provider={s.provider} />
      <span className={cn('truncate', s.status === 'running' && 'text-foreground')}>
        {s.label}
        {s.status === 'running' && '…'}
        {s.detail && <span className="text-muted-foreground"> · {s.detail}</span>}
      </span>
      {s.status === 'running' ? (
        <Loader2 className="ml-auto h-3 w-3 shrink-0 animate-spin" aria-label="Đang chạy" />
      ) : s.status === 'done' ? (
        <Check className="ml-auto h-3 w-3 shrink-0 text-primary" aria-label="Xong" />
      ) : (
        <AlertCircle className="ml-auto h-3 w-3 shrink-0 text-destructive" aria-label="Lỗi" />
      )}
    </li>
  )
}

// Tiến trình N7AI (gọi Gmail / Drive / Lịch / Học tập của tôi): đang trả lời ⇒ hiện từng bước; xong ⇒ thu gọn "Đã dùng N bước"
export function AiSteps({ steps, live }: { steps: AiStep[]; live: boolean }) {
  const [open, setOpen] = useState(false)
  if (!steps.length) return null
  if (live) {
    return (
      <ul className="mb-1.5 space-y-1" aria-live="polite">
        {steps.map((s) => (
          <StepRow key={s.id} step={s} />
        ))}
      </ul>
    )
  }
  return (
    <div className="mb-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
      >
        <span className="flex -space-x-1">
          {[...new Set(steps.map((s) => s.provider))].map((p) => (
            <StepIcon key={p} provider={p} />
          ))}
        </span>
        Đã dùng {steps.length} bước
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1 border-l border-border pl-2.5">
          {steps.map((s) => (
            <StepRow key={s.id} step={s} />
          ))}
        </ul>
      )}
    </div>
  )
}
