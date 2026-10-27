'use client'

import React, { useMemo, useState } from 'react'
import type { Course } from '@pu/schemas'
import { Search, Star } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { CourseListSkeleton } from '@/components/skeletons/catalog-skeleton'
import { useCourses } from '@/hooks/use-course'
import { useFollowedCourseIds } from '@/hooks/use-course-follow'
import { cn } from '@/lib/utils'
import { CourseTable } from './course-table'
import { SuggestCourseDialog } from './suggest-course-dialog'
import { buildFaculties } from './course-faculty'

type Sort = 'hot' | 'docs' | 'name'

const SORTS: { id: Sort; label: string }[] = [
  { id: 'name', label: 'Tên A–Z' },
  { id: 'hot', label: 'Nhiều thảo luận' },
  { id: 'docs', label: 'Nhiều tài liệu' }
]
const SELECT = 'h-9 rounded-lg border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer'

// Bỏ dấu tiếng Việt để tìm "giai tich" khớp "Giải tích"
const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

const compare: Record<Sort, (a: Course, b: Course) => number> = {
  name: (a, b) => a.name.localeCompare(b.name, 'vi'),
  hot: (a, b) => b.postCount - a.postCount || a.name.localeCompare(b.name, 'vi'),
  docs: (a, b) => b.documentCount - a.documentCount || a.name.localeCompare(b.name, 'vi')
}

// Tab "Môn học": bảng phẳng, tìm / lọc khoa / sắp xếp / chỉ môn đang theo dõi
export function CourseCatalog() {
  const { data: courses = [], isPending } = useCourses()
  const { data: followedIds = [] } = useFollowedCourseIds()
  const [q, setQ] = useState('')
  const [facultyId, setFacultyId] = useState('')
  const [sort, setSort] = useState<Sort>('name')
  const [onlyFollowed, setOnlyFollowed] = useState(false)
  const [suggestOpen, setSuggestOpen] = useState(false)

  const faculties = useMemo(() => buildFaculties(courses), [courses])
  const followed = useMemo(() => new Set(followedIds), [followedIds])

  const filtered = useMemo(() => {
    const needle = normalize(q.trim())
    return courses
      .filter((c) => (!facultyId || c.departmentId === facultyId) && (!onlyFollowed || followed.has(c.id)) && (!needle || normalize(`${c.name} ${c.code}`).includes(needle)))
      .sort(compare[sort])
  }, [courses, q, facultyId, onlyFollowed, followed, sort])

  if (isPending) return <CourseListSkeleton />

  return (
    <div className="space-y-3">
      <div className="mx-2 flex flex-wrap items-center gap-2 sm:mx-0">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên hoặc mã môn (vd. giải tích, IT101)" className="h-9 rounded-lg pl-9 text-sm" />
        </div>
        <select aria-label="Khoa" value={facultyId} onChange={(e) => setFacultyId(e.target.value)} className={cn(SELECT, 'max-w-60')}>
          <option value="">Tất cả khoa</option>
          {faculties.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} ({f.count})
            </option>
          ))}
        </select>
        <select aria-label="Sắp xếp" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={SELECT}>
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setOnlyFollowed((v) => !v)}
          aria-pressed={onlyFollowed}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors cursor-pointer',
            onlyFollowed ? 'border-foreground bg-foreground text-background' : 'border-input text-muted-foreground hover:text-foreground'
          )}
        >
          <Star className={cn('h-3.5 w-3.5', onlyFollowed && 'fill-current')} /> Đang theo dõi {followedIds.length > 0 && followedIds.length}
        </button>
      </div>

      <p className="mx-3 text-[11px] text-muted-foreground sm:mx-0">
        {filtered.length} / {courses.length} môn · Thiếu môn?{' '}
        <button type="button" onClick={() => setSuggestOpen(true)} className="font-medium text-foreground underline underline-offset-2 cursor-pointer">
          Đề xuất môn học
        </button>
      </p>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{onlyFollowed && !q && !facultyId ? 'Bạn chưa theo dõi môn nào. Bấm ngôi sao ở đầu dòng để theo dõi.' : 'Không tìm thấy môn học phù hợp.'}</p>
      ) : (
        <div className="px-2 sm:px-0">
          <CourseTable courses={filtered} followedIds={followed} />
        </div>
      )}
      <SuggestCourseDialog open={suggestOpen} onOpenChange={setSuggestOpen} />
    </div>
  )
}
