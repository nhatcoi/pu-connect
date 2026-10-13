'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { FileText, GraduationCap, Loader2, MessageSquare, Search } from 'lucide-react'
import { useCourses } from '@/hooks/use-course'
import { Input } from '@/components/ui/input'

// Bỏ dấu tiếng Việt để tìm "giai tich" khớp "Giải tích"
const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

// Danh mục học phần: tìm theo mã / tên, mở trang học phần
export default function CoursesPage() {
  const { data: courses = [], isPending } = useCourses()
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const needle = normalize(q.trim())
    if (!needle) return courses
    return courses.filter((c) => normalize(`${c.code} ${c.name}`).includes(needle))
  }, [courses, q])

  return (
    <>
      <div className="sticky top-0 md:top-14 z-30 bg-surface/90 backdrop-blur-md px-4 py-3 space-y-2.5">
        <h1 className="text-[15px] font-semibold tracking-tight flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-primary" /> Học phần
        </h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo mã hoặc tên môn (vd. IT101, giải tích)"
            className="pl-9 rounded-full h-9 text-sm"
          />
        </div>
      </div>

      {isPending ? (
        <div className="py-24 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Không tìm thấy học phần phù hợp.</p>
      ) : (
        <div className="px-2 sm:px-0 space-y-2">
          {filtered.map((course) => (
            <Link
              key={course.id}
              href={`/courses/${encodeURIComponent(course.code)}`}
              className="block rounded-xl bg-card px-4 py-3 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-primary/10 px-2 py-0.5 font-bold text-xs text-primary font-mono">
                  {course.code}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {course.credits} tín chỉ · {course.departmentName}
                </span>
              </div>
              <p className="font-semibold text-sm mt-1.5">{course.name}</p>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1.5">
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" /> {course.documentCount} tài liệu
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" /> {course.postCount} thảo luận
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
