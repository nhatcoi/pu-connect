'use client'

import React from 'react'
import Link from 'next/link'
import type { Course } from '@pu/schemas'
import { FileText, MessageSquare, Plus, Star } from 'lucide-react'
import { useAppStore } from '@/store'
import { useToggleFollowCourse } from '@/hooks/use-course-follow'
import { cn } from '@/lib/utils'
import type { FacultyInfo } from './course-faculty'

interface CourseItemProps {
  course: Course
  faculty?: FacultyInfo
  followed: boolean
}

const href = (c: Course) => `/courses/${encodeURIComponent(c.code)}`

// Sao theo dõi: nằm ngoài thẻ (nút không lồng trong link)
function FollowStar({ course, followed, className }: { course: Course; followed: boolean; className?: string }) {
  const toggle = useToggleFollowCourse()
  return (
    <button
      type="button"
      onClick={() => toggle.mutate({ courseId: course.id, follow: !followed })}
      aria-label={followed ? 'Bỏ theo dõi môn' : 'Theo dõi môn'}
      aria-pressed={followed}
      title={followed ? 'Bỏ theo dõi' : 'Theo dõi môn này'}
      className={cn('rounded-full p-1 text-muted-foreground transition-colors hover:text-brand-orange cursor-pointer', className)}
    >
      <Star className={cn('h-4 w-4', followed && 'fill-brand-orange text-brand-orange')} />
    </button>
  )
}

// Thẻ môn: dải màu theo khoa, bấm cả thẻ để vào trang môn
export function CourseCard({ course, faculty, followed }: CourseItemProps) {
  const setCreateDocumentOpen = useAppStore((s) => s.setCreateDocumentOpen)
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl bg-card transition-shadow hover:shadow-md">
      <span className={cn('h-1 w-full', faculty?.tone.bar ?? 'bg-muted')} />
      <Link href={href(course)} aria-label={course.name} className="absolute inset-0 z-0" />
      <div className="pointer-events-none flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-center gap-2 pr-7">
          <span className={cn('rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold', faculty?.tone.chip ?? 'bg-muted text-muted-foreground')}>{course.code}</span>
          <span className="text-[11px] text-muted-foreground">{course.credits} tín chỉ</span>
        </div>
        <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-foreground group-hover:text-primary">{course.name}</p>
        {faculty && (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', faculty.tone.dot)} />
            <span className="truncate">{faculty.name}</span>
          </p>
        )}
        <div className="mt-auto flex items-center gap-3 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" /> {course.documentCount}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" /> {course.postCount}
          </span>
        </div>
      </div>
      <FollowStar course={course} followed={followed} className="absolute right-2.5 top-3 z-10" />
      {course.documentCount === 0 && (
        <button
          type="button"
          onClick={() => setCreateDocumentOpen(true)}
          className="absolute bottom-2.5 right-3 z-10 inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 px-2 py-0.5 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/5 cursor-pointer"
        >
          <Plus className="h-3 w-3" /> Chia sẻ tài liệu
        </button>
      )}
    </div>
  )
}

// Dòng bảng: gọn, so sánh nhiều môn
export function CourseTableRow({ course, faculty, followed }: CourseItemProps) {
  return (
    <div className="relative flex items-center gap-3 rounded-xl bg-card px-3 py-2 text-xs transition-colors hover:bg-muted/40">
      <Link href={href(course)} aria-label={course.name} className="absolute inset-0 z-0" />
      <span className={cn('pointer-events-none h-6 w-1 shrink-0 rounded-full', faculty?.tone.bar ?? 'bg-muted')} />
      <span className="pointer-events-none min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-foreground">{course.name}</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          <span className="font-mono">{course.code}</span> · {faculty?.name} · {course.credits} tín chỉ
        </span>
      </span>
      <span className="pointer-events-none hidden shrink-0 items-center gap-3 text-[11px] text-muted-foreground sm:flex">
        <span className="flex items-center gap-1">
          <FileText className="h-3.5 w-3.5" /> {course.documentCount}
        </span>
        <span className="flex items-center gap-1">
          <MessageSquare className="h-3.5 w-3.5" /> {course.postCount}
        </span>
      </span>
      <FollowStar course={course} followed={followed} className="relative z-10" />
    </div>
  )
}
