'use client'

import React, { useEffect, useState } from 'react'
import {
  AlertCircle,
  AtSign,
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  FileText,
  Globe,
  Layers,
  Loader2,
  MessagesSquare,
  Paperclip,
  Search,
  Users
} from 'lucide-react'
import { motion } from 'motion/react'
import type { AiStep } from '@pu/schemas'
import { PuMark } from '@/components/brand/pu-logo'
import { ConnectorIcon } from '@/components/n7ai/connector-icon'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

const ICONS: Partial<Record<AiStep['provider'], React.ComponentType<{ className?: string }>>> = {
  library: BookOpen,
  my_documents: FileText,
  my_groups: Users,
  my_study: Layers,
  my_chats: MessagesSquare,
  web: Globe,
  web_search: Search,
  refs: AtSign,
  files: Paperclip,
  memory: Brain
}

// Biểu tượng nguồn của bước: logo Google (Drive / Lịch / Gmail), logo PU, hoặc icon nguồn nội bộ
function StepIcon({ provider }: { provider: AiStep['provider'] }) {
  if (provider === 'puc') return <PuMark className="h-3.5 w-3.5 shrink-0" />
  const Icon = ICONS[provider]
  if (Icon) return <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
  return <ConnectorIcon id={provider} className="h-3.5 w-3.5" />
}

function StepRow({ step: s }: { step: AiStep }) {
  return (
    <li className={cn('relative flex min-w-0 items-center gap-2 text-xs text-muted-foreground', s.resultCount === 0 && s.status === 'done' && 'opacity-60')}>
      <span className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-card ring-1 ring-border">
        <StepIcon provider={s.provider} />
      </span>
      <span className={cn('min-w-0 truncate', s.status === 'running' && 'text-foreground')}>
        {s.label}
        {s.status === 'running' && '…'}
        {s.detail && <span className="text-muted-foreground"> · {s.detail}</span>}
        {s.resultCount !== undefined && s.status === 'done' && (
          <span className="text-muted-foreground"> · {s.resultCount ? `${s.resultCount} kết quả` : 'không có kết quả'}</span>
        )}
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

// Danh sách bước dạng timeline (đường nối dọc sau icon)
function StepList({ steps }: { steps: AiStep[] }) {
  return (
    <ul className="relative space-y-1.5 before:absolute before:bottom-2 before:left-2.5 before:top-2 before:w-px before:bg-border" aria-live="polite">
      {steps.map((s) => (
        <StepRow key={s.id} step={s} />
      ))}
    </ul>
  )
}

const seconds = (ms: number) => (ms < 10_000 ? (ms / 1000).toFixed(1) : Math.round(ms / 1000).toString())

// Số giây kể từ lúc tin N7AI được tạo (đồng hồ chạy khi đang trả lời)
function useElapsed(since: string | undefined, running: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(t)
  }, [running])
  return since ? Math.max(0, now - new Date(since).getTime()) : 0
}

// Tiến trình N7AI: đọc tệp / bộ nhớ, tìm nguồn, gọi tool — đang trả lời ⇒ timeline + đồng hồ; xong ⇒ một dòng "Xem quá trình · 6s", bấm mới hiện các bước
export function AiSteps({
  steps,
  live,
  startedAt,
  durationMs,
  writing,
  idleLabel = 'Đang suy nghĩ'
}: {
  steps: AiStep[]
  live: boolean
  startedAt?: string
  durationMs?: number
  writing?: boolean
  idleLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const elapsed = useElapsed(startedAt, live)
  if (live) {
    return (
      <div className="mb-2 space-y-1.5">
        {steps.length > 0 && <StepList steps={steps} />}
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin text-primary" aria-hidden />
          {writing ? 'Đang viết câu trả lời' : steps.some((s) => s.status === 'running') ? 'Đang xử lý' : idleLabel}
          {startedAt && <span className="tabular-nums">· {seconds(elapsed)}s</span>}
        </p>
      </div>
    )
  }
  if (!steps.length && !durationMs) return null

  return (
    <Collapsible open={open} onOpenChange={setOpen} disabled={!steps.length} className="mb-1.5">
      <CollapsibleTrigger className="group flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
        <Brain className="h-3.5 w-3.5 text-primary/80" aria-hidden />
        <span>Xem quá trình{durationMs ? ` · ${seconds(durationMs)}s` : ''}</span>
        {steps.length > 0 && (
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className="inline-flex text-muted-foreground/80 group-hover:text-foreground"
          >
            <ChevronDown className="h-3 w-3" />
          </motion.span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <StepList steps={steps} />
      </CollapsibleContent>
    </Collapsible>
  )
}
