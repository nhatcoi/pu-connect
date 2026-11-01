'use client'

import React, { useLayoutEffect, useRef } from 'react'
import { X, type LucideIcon } from 'lucide-react'

export interface LeadToken {
  key: string
  icon: LucideIcon | React.ComponentType<{ size?: number; className?: string; strokeWidth?: number | string }>
  label: string
  kind: string
  onRemove: () => void
}

export function ComposerLead({
  tokens,
  onWidth
}: {
  tokens: LeadToken[]
  onWidth: (width: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const report = () => onWidth(node.offsetWidth)
    report()
    const observer = new ResizeObserver(report)
    observer.observe(node)
    return () => {
      observer.disconnect()
      onWidth(0)
    }
  }, [onWidth, tokens])

  if (!tokens.length) return null

  return (
    <div
      ref={ref}
      role="group"
      className="dt-composer-lead absolute top-1 left-0 z-10 flex items-center gap-1 max-w-[75%] h-[32px] pointer-events-none select-none"
    >
      {tokens.map((token) => {
        const Icon = token.icon
        return (
          <button
            key={token.key}
            type="button"
            onClick={token.onRemove}
            title={`Bỏ chọn ${token.label}`}
            className="dt-lead-token group pointer-events-auto inline-flex items-center gap-1.5 h-[28px] px-1.5 rounded-md text-[#e05d38] dark:text-[#ff7a59] font-medium text-[15px] whitespace-nowrap hover:bg-[#e05d38]/10 transition-colors cursor-pointer"
          >
            <span className="dt-lead-icon relative grid place-items-center w-4 h-4 shrink-0">
              <Icon
                size={15}
                strokeWidth={1.8}
                className="col-start-1 row-start-1 transition-all duration-150 group-hover:opacity-0 group-hover:scale-50 text-[#e05d38] dark:text-[#ff7a59]"
              />
              <X
                size={14}
                strokeWidth={2.2}
                className="col-start-1 row-start-1 opacity-0 scale-50 transition-all duration-150 group-hover:opacity-100 group-hover:scale-100 text-[#e05d38] dark:text-[#ff7a59]"
              />
            </span>
            <span className="dt-lead-label truncate max-w-[160px] leading-none">{token.label}</span>
          </button>
        )
      })}
    </div>
  )
}
