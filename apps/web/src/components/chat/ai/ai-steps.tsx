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
import type { AiStep } from '@pu/schemas'
import { PuMark } from '@/components/brand/pu-logo'
import { ConnectorIcon } from '@/components/n7ai/connector-icon'
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
    <li className="relative flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
      <span className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-card ring-1 ring-border">
        <StepIcon provider={s.provider} />
      </span>
      <span className={cn('min-w-0 truncate', s.status === 'running' && 'text-foreground')}>
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

// Tóm tắt khi xong: "4 nguồn · 2 công cụ"
function summary(steps: AiStep[]) {
  const sources = steps.reduce((n, s) => n + (Number(/^(\d+) (nguồn|trang)/.exec(s.detail ?? '')?.[1]) || 0), 0)
  const tools = steps.filter((s) => !['library', 'my_documents', 'my_groups', 'web', 'web_search', 'refs', 'files', 'memory'].includes(s.provider)).length
  return [sources ? `${sources} nguồn` : null, tools ? `${tools} công cụ` : null].filter(Boolean).join(' · ')
}

// Tiến trình N7AI: đọc tệp / bộ nhớ, tìm nguồn, gọi tool — đang trả lời ⇒ timeline + đồng hồ; xong ⇒ thu gọn "Đã xử lý 6.2s · 4 nguồn"
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
  const info = summary(steps)
  return (
    <div className="mb-1.5">
      <button
        type="button"
        onClick={() => steps.length && setOpen((o) => !o)}
        aria-expanded={open}
        disabled={!steps.length}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground enabled:cursor-pointer enabled:hover:text-foreground"
      >
        <span className="flex -space-x-1">
          {[...new Set(steps.map((s) => s.provider))].slice(0, 4).map((p) => (
            <StepIcon key={p} provider={p} />
          ))}
        </span>
        {durationMs ? `Đã xử lý ${seconds(durationMs)}s` : `Đã dùng ${steps.length} bước`}
        {info && <span>· {info}</span>}
        {steps.length > 0 && <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />}
      </button>
      {open && (
        <div className="mt-2">
          <StepList steps={steps} />
        </div>
      )}
    </div>
  )
}
