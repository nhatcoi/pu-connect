'use client'

import * as React from 'react'
import { Highlight, HighlightItem } from '@/components/animate-ui/primitives/effects/highlight'
import { cn } from '@/lib/utils'

export interface SlidingTabItem<T extends string> {
  id: T
  label: React.ReactNode
  badge?: React.ReactNode
}

interface SlidingTabsProps<T extends string> {
  items: SlidingTabItem<T>[]
  value: T
  onChange: (id: T) => void
  className?: string
  tabClassName?: string
}

// Tab gạch chân trượt mượt khi đổi tab (animate-ui Highlight, layoutId)
export function SlidingTabs<T extends string>({
  items,
  value,
  onChange,
  className,
  tabClassName
}: SlidingTabsProps<T>) {
  return (
    <div role="tablist" className={cn('flex items-center gap-6 text-[13px] font-medium', className)}>
      <Highlight
        value={value}
        click={false}
        controlledItems
        className="inset-x-0 bottom-1.5 h-0.5 rounded-full bg-primary"
        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
      >
        {items.map((item) => (
          <HighlightItem key={item.id} value={item.id}>
            <button
              type="button"
              role="tab"
              aria-selected={value === item.id}
              onClick={() => onChange(item.id)}
              className={cn(
                'relative py-3 whitespace-nowrap cursor-pointer transition-colors',
                value === item.id ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground',
                tabClassName
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                {item.label}
                {item.badge !== undefined && <span className="text-[11px] text-muted-foreground">{item.badge}</span>}
              </span>
            </button>
          </HighlightItem>
        ))}
      </Highlight>
    </div>
  )
}
