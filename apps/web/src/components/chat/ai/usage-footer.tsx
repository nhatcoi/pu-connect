'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Coins, DatabaseZap, X } from 'lucide-react'
import type { UsageSummary } from './usage-summary'

export function UsageFooter({ turn, session }: { turn: UsageSummary; session?: UsageSummary }) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<'turn' | 'session'>('turn')
  const anchor = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const id = useId()
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const summary = scope === 'turn' || !session ? turn : session
  const shown = summary

  const number = (n?: number | null) => (n == null ? '—' : n.toLocaleString('vi-VN'))
  const rate = (n?: number | null) => (n == null ? '—' : `${(n * 100).toFixed(1)}%`)
  const compact = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  })
  const tokenFigure = compact.format(turn.total_tokens ?? 0).toLowerCase()
  const hitFigure = rate(turn.cache_hit_rate ?? 0)
  const seconds = (n?: number | null) => (n == null ? '—' : `${n.toFixed(2)}s`)
  const cacheKnown = Boolean(summary.cache_reported_calls)
  const uncached = cacheKnown
    ? Math.max(
        0,
        (summary.cache_input_tokens ?? 0) -
          (shown.cache_read_input_tokens ?? 0) -
          (shown.cache_creation_input_tokens ?? 0)
      )
    : null

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect()
      const box = panel.current?.getBoundingClientRect()
      if (!rect || !box) return
      const above = rect.top - box.height - 8
      setPosition({
        left: Math.max(12, Math.min(rect.right - box.width, window.innerWidth - box.width - 12)),
        top: Math.max(
          12,
          above >= 12 ? above : Math.min(rect.bottom + 8, window.innerHeight - box.height - 12)
        ),
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, scope])

  useEffect(() => {
    if (!open) return
    const dismiss = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node) && !anchor.current?.contains(e.target as Node))
        setOpen(false)
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        anchor.current?.focus()
      }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    panel.current?.focus()
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const rows: [string, string][] = [
    ['Input tokens', number(shown.prompt_tokens)],
    ['Uncached input', number(uncached)],
    ['Cache read', cacheKnown ? number(shown.cache_read_input_tokens) : '—'],
    ['Cache write', number(summary.cache_write_reported_calls ? summary.cache_creation_input_tokens : null)],
    ['Output tokens', number(shown.completion_tokens)],
    ['Reasoning tokens', number(shown.reasoning_tokens)],
    ['Cache hit rate', rate(shown.cache_hit_rate ?? 0)],
    ['Model time', seconds(shown.duration_seconds)],
    ['TTFT', seconds(shown.ttft_seconds)],
    ['TPS', shown.tokens_per_second == null ? '—' : `${shown.tokens_per_second.toFixed(1)} tok/s`],
  ]

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="dialog"
        aria-label={`${tokenFigure} tokens, Cache hit rate ${hitFigure}`}
        onClick={() => setOpen(!open)}
        className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary cursor-pointer select-none"
      >
        <span className="inline-flex items-center gap-1">
          <Coins size={12} strokeWidth={1.8} aria-hidden="true" />
          <span>{tokenFigure} tokens</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <DatabaseZap size={12} strokeWidth={1.8} aria-hidden="true" />
          <span>Cache hit rate {hitFigure}</span>
        </span>
        <ChevronDown
          size={11}
          aria-hidden="true"
          className={`-ml-0.5 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="dialog"
            aria-label="Token usage and performance"
            tabIndex={-1}
            style={position}
            className="fixed z-[100] w-[272px] max-w-[calc(100vw-24px)] max-h-[calc(100dvh-24px)] overflow-y-auto rounded-xl border border-border bg-background p-3 text-xs text-foreground shadow-xl outline-none animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="mb-3 flex items-center gap-1" role="group" aria-label="Statistics scope">
              {(['turn', 'session'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={scope === value}
                  onClick={() => setScope(value)}
                  className={`flex-1 rounded-md px-2 py-1 text-[11px] transition-colors cursor-pointer ${
                    scope === value
                      ? 'bg-muted font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  {value === 'turn' ? 'Lượt này' : 'Toàn phiên'}
                </button>
              ))}
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => {
                  setOpen(false)
                  anchor.current?.focus()
                }}
                className="ml-1 rounded p-1 text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>

            <div className="mb-2 flex items-baseline justify-between border-b border-border/70 pb-2">
              <span className="font-medium text-muted-foreground">Total tokens</span>
              <span className="text-base font-semibold tabular-nums text-foreground">
                {number(shown.total_tokens)}
              </span>
            </div>

            <dl className="space-y-1.5">
              {rows.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4">
                  <dt className="text-[11px] leading-4 text-muted-foreground">{label}</dt>
                  <dd className="shrink-0 text-[11px] leading-4 font-medium tabular-nums text-foreground">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>,
          document.body
        )}
    </>
  )
}
