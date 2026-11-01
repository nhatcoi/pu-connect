'use client'

import React, { useState } from 'react'
import { Check, HelpCircle, Send } from 'lucide-react'
import type { AskUserQuestion } from '@pu/schemas'
import { cn } from '@/lib/utils'

interface AskUserCardProps {
  questions: AskUserQuestion[]
  onSelectOption: (answer: string) => void
  disabled?: boolean
}

export function AskUserCard({ questions, onSelectOption, disabled = false }: AskUserCardProps) {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({})
  const [customText, setCustomText] = useState('')

  if (!questions || questions.length === 0) return null

  const handleToggle = (qId: string, label: string, multi = false) => {
    if (disabled) return
    if (!multi) {
      // Single select: kích hoạt ngay
      setSelectedOptions({ [qId]: [label] })
      onSelectOption(label)
      return
    }

    // Multi select
    setSelectedOptions((prev) => {
      const current = prev[qId] || []
      const exists = current.includes(label)
      const next = exists ? current.filter((x) => x !== label) : [...current, label]
      return { ...prev, [qId]: next }
    })
  }

  const handleMultiSubmit = (qId: string) => {
    if (disabled) return
    const chosen = selectedOptions[qId] || []
    if (chosen.length > 0) {
      onSelectOption(chosen.join(', '))
    }
  }

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled || !customText.trim()) return
    onSelectOption(customText.trim())
    setCustomText('')
  }

  return (
    <div className="my-3 space-y-3 rounded-2xl border border-primary/20 bg-primary/[0.03] p-4 text-xs">
      <div className="flex items-center gap-2 font-medium text-primary">
        <HelpCircle className="h-4 w-4" />
        <span>N7AI cần thêm định hướng từ bạn:</span>
      </div>

      {questions.map((q) => {
        const selected = selectedOptions[q.id] || []
        const hasOptions = q.options && q.options.length > 0

        return (
          <div key={q.id} className="space-y-2.5">
            {q.header && (
              <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {q.header}
              </span>
            )}
            <p className="font-medium text-foreground">{q.prompt}</p>

            {hasOptions && (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {q.options.map((opt) => {
                  const isChecked = selected.includes(opt.label)

                  return (
                    <button
                      key={opt.label}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleToggle(q.id, opt.label, q.multi_select)}
                      className={cn(
                        'flex flex-col items-start rounded-xl border p-2.5 text-left transition-all',
                        isChecked
                          ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                          : 'border-border/60 bg-background/80 hover:border-primary/50 hover:bg-muted/40',
                        disabled && 'opacity-60 cursor-not-allowed'
                      )}
                    >
                      <div className="flex w-full items-center justify-between font-medium">
                        <span>{opt.label}</span>
                        {isChecked && <Check className="h-3.5 w-3.5 text-primary" />}
                      </div>
                      {opt.description && <span className="mt-0.5 text-[11px] text-muted-foreground">{opt.description}</span>}
                    </button>
                  )
                })}
              </div>
            )}

            {q.multi_select && selected.length > 0 && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => handleMultiSubmit(q.id)}
                className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground text-xs shadow-sm hover:bg-primary/90"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Tiếp tục với các lựa chọn đã chọn ({selected.length})</span>
              </button>
            )}

            {q.allow_free_text && (
              <form onSubmit={handleCustomSubmit} className="mt-2 flex gap-2">
                <input
                  type="text"
                  disabled={disabled}
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder={q.placeholder || 'Hoặc nhập ý kiến khác của bạn...'}
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="submit"
                  disabled={disabled || !customText.trim()}
                  className="inline-flex items-center justify-center rounded-xl bg-primary px-3 py-1.5 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            )}
          </div>
        )
      })}
    </div>
  )
}

