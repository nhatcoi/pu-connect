'use client'

import React from 'react'
import { BadgeCheck, GraduationCap, ShieldAlert, Award, Star } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface AcademicBadgeProps {
  role?: string | null
  reputationPoints?: number | null
  className?: string
}

export function AcademicBadge({ role, reputationPoints = 0, className }: AcademicBadgeProps) {
  const isTopContributor = (reputationPoints || 0) >= 300

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      {/* 1. Lecturer / Giảng viên */}
      {role === 'lecturer' && (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold">
          <GraduationCap className="h-3 w-3" />
          <span>Giảng viên</span>
          <BadgeCheck className="h-3 w-3 text-blue-500 fill-blue-500/20" />
        </span>
      )}

      {/* 2. TA / Trợ giảng */}
      {role === 'ta' && (
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 px-1.5 py-0.5 text-[10px] font-semibold">
          <Star className="h-3 w-3 fill-purple-500/20" />
          <span>Trợ giảng (TA)</span>
        </span>
      )}

      {/* 3. Admin / Ban Quản trị */}
      {role === 'admin' && (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold">
          <ShieldAlert className="h-3 w-3" />
          <span>Ban Quản trị</span>
        </span>
      )}

      {/* 4. Top Contributor */}
      {isTopContributor && role === 'student' && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold">
          <Award className="h-3 w-3" />
          <span>Top Contributor</span>
        </span>
      )}
    </div>
  )
}
