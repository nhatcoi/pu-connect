'use client'

import React from 'react'
import { HelpCircle, FileText, Users, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PostType } from '@pu/schemas'

interface ComposerIntentSelectorProps {
  value: PostType
  onChange: (type: PostType) => void
}

export const INTENT_TABS: {
  type: PostType
  label: string
  icon: React.ElementType
}[] = [
  {
    type: 'general',
    label: 'Thảo luận',
    icon: MessageSquare
  },
  {
    type: 'qa',
    label: 'Hỏi đáp bài tập',
    icon: HelpCircle
  },
  {
    type: 'document',
    label: 'Đề thi & Slide',
    icon: FileText
  },
  {
    type: 'group_recruit',
    label: 'Học nhóm',
    icon: Users
  }
]

export function ComposerIntentSelector({ value, onChange }: ComposerIntentSelectorProps) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
      {INTENT_TABS.map((tab) => {
        const Icon = tab.icon
        const isSelected = value === tab.type

        return (
          <button
            key={tab.type}
            type="button"
            onClick={() => onChange(tab.type)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 shrink-0 cursor-pointer',
              isSelected
                ? 'bg-foreground text-background border-foreground font-semibold shadow-xs'
                : 'border-border/60 bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
