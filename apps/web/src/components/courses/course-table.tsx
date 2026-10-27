'use client'

import React from 'react'
import Link from 'next/link'
import type { Course } from '@pu/schemas'
import { Star } from 'lucide-react'
import { useToggleFollowCourse } from '@/hooks/use-course-follow'
import { cn } from '@/lib/utils'
import { shortFacultyName } from './course-faculty'

// Cột: sao · môn (tên + mã) · khoa · tín chỉ · tài liệu · thảo luận
const COLS = 'grid grid-cols-[2rem_minmax(0,1fr)_3rem_3.5rem_3.5rem] sm:grid-cols-[2rem_minmax(0,1fr)_minmax(0,14rem)_3.5rem_4.5rem_4.5rem] items-center gap-x-3'

// Sao theo dõi: nằm ngoài link của dòng (nút không lồng trong link)
function FollowStar({ course, followed }: { course: Course; followed: boolean }) {
  const toggle = useToggleFollowCourse()
  return (
    <button
      type="button"
      onClick={() => toggle.mutate({ courseId: course.id, follow: !followed })}
      aria-label={followed ? 'Bỏ theo dõi môn' : 'Theo dõi môn'}
      aria-pressed={followed}
      title={followed ? 'Bỏ theo dõi' : 'Theo dõi môn này'}
      className="relative z-10 rounded-md p-1 text-muted-foreground/60 transition-colors hover:text-foreground cursor-pointer"
    >
      <Star className={cn('h-4 w-4', followed && 'fill-foreground text-foreground')} />
    </button>
  )
}

// Bảng môn học phẳng: dòng kẻ mảnh, bấm cả dòng để vào trang môn
export function CourseTable({ courses, followedIds }: { courses: Course[]; followedIds: Set<string> }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className={cn(COLS, 'border-b border-border bg-muted/30 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground')}>
        <span />
        <span>Môn học</span>
        <span className="hidden sm:block">Khoa</span>
        <span className="text-right">Tín chỉ</span>
        <span className="text-right">Tài liệu</span>
        <span className="hidden text-right sm:block">Thảo luận</span>
      </div>
      <ul className="divide-y divide-border/70">
        {courses.map((c) => (
          <li key={c.id} className={cn(COLS, 'relative px-3 py-2.5 text-xs transition-colors hover:bg-muted/40')}>
            <Link href={`/courses/${encodeURIComponent(c.code)}`} aria-label={c.name} className="absolute inset-0" />
            <FollowStar course={c} followed={followedIds.has(c.id)} />
            <span className="pointer-events-none min-w-0">
              <span className="block truncate text-[13px] font-semibold text-foreground">{c.name}</span>
              <span className="block font-mono text-[11px] text-muted-foreground">{c.code}</span>
            </span>
            <span className="pointer-events-none hidden truncate text-muted-foreground sm:block">{shortFacultyName(c.departmentName)}</span>
            <span className="pointer-events-none text-right tabular-nums text-muted-foreground">{c.credits}</span>
            <span className={cn('pointer-events-none text-right tabular-nums', c.documentCount ? 'text-foreground' : 'text-muted-foreground/60')}>{c.documentCount}</span>
            <span className={cn('pointer-events-none hidden text-right tabular-nums sm:block', c.postCount ? 'text-foreground' : 'text-muted-foreground/60')}>{c.postCount}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
