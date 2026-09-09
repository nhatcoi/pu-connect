'use client'

import React from 'react'
import { BadgeCheck, GraduationCap, ShieldAlert, Star, Users, Award } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AcademicBadgeProps {
  role?: string | null
  reputationPoints?: number | null
  className?: string
}

export function AcademicBadge({ role, className }: AcademicBadgeProps) {
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

      {/* 4. Club Lead / Ban Chủ nhiệm CLB */}
      {role === 'club_lead' && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold">
          <Users className="h-3 w-3" />
          <span>Chủ nhiệm CLB</span>
        </span>
      )}

      {/* 5. Alumni / Cựu sinh viên */}
      {role === 'alumni' && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold">
          <Award className="h-3 w-3" />
          <span>Cựu sinh viên</span>
        </span>
      )}
    </div>
  )
}
