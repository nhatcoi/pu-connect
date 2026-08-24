'use client'

import React from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Globe2, Building2, BookOpen, Users, ChevronDown, Check } from 'lucide-react'
import type { TargetAudience } from '@pu/schemas'

interface ComposerAudienceMenuProps {
  value: TargetAudience
  onChange: (audience: TargetAudience) => void
  facultyCode?: string
  courseCode?: string
}

export const AUDIENCE_CONFIG: Record<
  TargetAudience,
  { label: string; icon: React.ElementType; description: string }
> = {
  everyone: {
    label: 'Toàn trường có thể trả lời',
    icon: Globe2,
    description: 'Bất kỳ sinh viên, giảng viên nào trong trường'
  },
  faculty: {
    label: 'Cùng Khoa / Viện',
    icon: Building2,
    description: 'Chỉ các bạn sinh viên và giảng viên thuộc cùng Khoa/Viện'
  },
  course_members: {
    label: 'Cùng học phần',
    icon: BookOpen,
    description: 'Những người đang theo học hoặc quan tâm môn này'
  },
  followers: {
    label: 'Người bạn theo dõi',
    icon: Users,
    description: 'Chỉ những tài khoản nằm trong danh sách đang theo dõi'
  }
}

export function ComposerAudienceMenu({
  value,
  onChange,
  facultyCode,
  courseCode
}: ComposerAudienceMenuProps) {
  const current = AUDIENCE_CONFIG[value] || AUDIENCE_CONFIG.everyone
  const Icon = current.icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-foreground/80 hover:bg-muted hover:text-foreground transition-colors cursor-pointer outline-none max-w-[130px] sm:max-w-none"
        >
          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{current.label}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-1.5 space-y-1 rounded-2xl shadow-xl border border-border">
        <div className="px-2 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          Ai có thể thảo luận và trả lời?
        </div>
        {(Object.keys(AUDIENCE_CONFIG) as TargetAudience[]).map((key) => {
          const item = AUDIENCE_CONFIG[key]
          const ItemIcon = item.icon
          const isSelected = value === key

          return (
            <DropdownMenuItem
              key={key}
              onClick={() => onChange(key)}
              className="flex items-start gap-2.5 p-2 rounded-xl cursor-pointer transition-colors"
            >
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
                <ItemIcon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">{item.label}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                  {key === 'faculty' && facultyCode
                    ? `Chỉ thành viên thuộc Khoa ${facultyCode}`
                    : key === 'course_members' && courseCode
                    ? `Chỉ thành viên môn ${courseCode}`
                    : item.description}
                </p>
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
