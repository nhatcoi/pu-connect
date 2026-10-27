'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Course } from '@pu/schemas'
import { ArrowDownUp, Flame, LayoutGrid, List, Search, Star } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { CourseListSkeleton } from '@/components/skeletons/catalog-skeleton'
import { useCourses } from '@/hooks/use-course'
import { useFollowedCourseIds } from '@/hooks/use-course-follow'
import { cn } from '@/lib/utils'
import { CourseCard, CourseTableRow } from './course-card'
import { buildFaculties } from './course-faculty'

type Sort = 'hot' | 'docs' | 'name'
type View = 'grid' | 'table'

const SORTS: { id: Sort; label: string }[] = [
  { id: 'hot', label: 'Sôi nổi nhất' },
  { id: 'docs', label: 'Nhiều tài liệu' },
  { id: 'name', label: 'Tên A–Z' }
]
const VIEW_KEY = 'pu:courses:view'

// Bỏ dấu tiếng Việt để tìm "giai tich" khớp "Giải tích"
const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

const compare: Record<Sort, (a: Course, b: Course) => number> = {
  hot: (a, b) => b.postCount - a.postCount || b.documentCount - a.documentCount || a.name.localeCompare(b.name, 'vi'),
  docs: (a, b) => b.documentCount - a.documentCount || b.postCount - a.postCount || a.name.localeCompare(b.name, 'vi'),
  name: (a, b) => a.name.localeCompare(b.name, 'vi')
}

// Tab "Môn học": theo dõi, đang sôi nổi, toàn bộ môn lọc theo khoa; lưới hoặc bảng
export function CourseCatalog() {
  const { data: courses = [], isPending } = useCourses()
  const { data: followedIds = [] } = useFollowedCourseIds()
  const [q, setQ] = useState('')
  const [facultyId, setFacultyId] = useState('')
  const [sort, setSort] = useState<Sort>('hot')
  const [view, setView] = useState<View>('grid')

  // Kiểu xem nhớ theo trình duyệt (đọc sau mount để khỏi lệch SSR)
  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === 'table') setView('table')
    } catch {
      // storage bị chặn ⇒ dùng lưới
    }
  }, [])
  const changeView = (next: View) => {
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // bỏ qua
    }
  }

  const faculties = useMemo(() => buildFaculties(courses), [courses])
  const facultyById = useMemo(() => new Map(faculties.map((f) => [f.id, f])), [faculties])
  const followed = useMemo(() => new Set(followedIds), [followedIds])

  const filtered = useMemo(() => {
    const needle = normalize(q.trim())
    return courses
      .filter((c) => (!facultyId || c.departmentId === facultyId) && (!needle || normalize(`${c.name} ${c.code}`).includes(needle)))
      .sort(compare[sort])
  }, [courses, q, facultyId, sort])

  const followedCourses = useMemo(() => followedIds.map((id) => courses.find((c) => c.id === id)).filter((c): c is Course => !!c), [followedIds, courses])
  const hot = useMemo(() => courses.filter((c) => c.postCount > 0).sort((a, b) => b.postCount - a.postCount || b.documentCount - a.documentCount).slice(0, 4), [courses])
  const searching = !!q.trim() || !!facultyId

  if (isPending) return <CourseListSkeleton />

  return (
    <div className="space-y-5 @container">
      <div className="mx-2 flex items-center gap-2 sm:mx-0">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo mã hoặc tên môn (vd. IT101, giải tích)" className="h-9 rounded-full pl-9 text-sm" />
        </div>
        <div className="flex shrink-0 rounded-full bg-muted p-0.5" role="group" aria-label="Kiểu xem">
          {(
            [
              ['grid', LayoutGrid, 'Lưới'],
              ['table', List, 'Bảng']
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => changeView(id)}
              aria-pressed={view === id}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors cursor-pointer',
                view === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden @md:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {!searching && followedCourses.length > 0 && (
        <section className="space-y-2 px-2 sm:px-0">
          <h2 className="flex items-center gap-1.5 text-[13px] font-semibold">
            <Star className="h-4 w-4 fill-brand-orange text-brand-orange" /> Đang theo dõi <span className="text-[11px] font-normal text-muted-foreground">{followedCourses.length} môn</span>
          </h2>
          <div className="grid grid-cols-1 gap-2.5 @md:grid-cols-2 @3xl:grid-cols-3">
            {followedCourses.map((c) => (
              <CourseCard key={c.id} course={c} faculty={facultyById.get(c.departmentId)} followed />
            ))}
          </div>
        </section>
      )}

      {!searching && hot.length > 0 && (
        <section className="space-y-2 px-2 sm:px-0">
          <h2 className="flex items-center gap-1.5 text-[13px] font-semibold">
            <Flame className="h-4 w-4 text-brand-orange" /> Đang sôi nổi <span className="text-[11px] font-normal text-muted-foreground">xếp theo số thảo luận</span>
          </h2>
          <div className="grid grid-cols-2 overflow-hidden rounded-xl bg-card @3xl:grid-cols-4">
            {hot.map((c, i) => (
              <Link key={c.id} href={`/courses/${encodeURIComponent(c.code)}`} className="flex gap-2.5 border-border/60 p-3 transition-colors hover:bg-muted/40 @3xl:border-r @3xl:last:border-r-0">
                <span className="font-mono text-lg font-bold leading-none text-muted-foreground/50">{String(i + 1).padStart(2, '0')}</span>
                <span className="min-w-0">
                  <span className="block font-mono text-[10px] font-semibold text-primary">{c.code}</span>
                  <span className="line-clamp-3 text-xs font-semibold leading-4">{c.name}</span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">{c.postCount} thảo luận</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2.5">
        <div className="mx-2 flex items-center justify-between gap-2 sm:mx-0">
          <h2 className="text-[13px] font-semibold">
            Tất cả môn học{' '}
            <span className="text-[11px] font-normal text-muted-foreground">
              {filtered.length} / {courses.length} môn
            </span>
          </h2>
          <label className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">
            <ArrowDownUp className="h-3.5 w-3.5" />
            <span className="hidden @md:inline">Sắp xếp:</span>
            <select aria-label="Sắp xếp" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="bg-transparent font-semibold text-foreground outline-none cursor-pointer">
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="-mx-1 flex flex-wrap gap-1.5 px-3 sm:px-0">
          <button
            type="button"
            onClick={() => setFacultyId('')}
            className={cn(
              'rounded-full border px-3 py-1 text-[11px] font-medium transition-colors cursor-pointer',
              !facultyId ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            Tất cả {courses.length}
          </button>
          {faculties.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFacultyId(facultyId === f.id ? '' : f.id)}
              className={cn(
                'inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors cursor-pointer',
                facultyId === f.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              <span className={cn('h-2 w-2 shrink-0 rounded-full', f.tone.dot)} />
              <span className="truncate">{f.name}</span>
              <span className="text-muted-foreground">{f.count}</span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Không tìm thấy môn học phù hợp.</p>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 gap-2.5 px-2 @md:grid-cols-2 @3xl:grid-cols-3 sm:px-0">
            {filtered.map((c) => (
              <CourseCard key={c.id} course={c} faculty={facultyById.get(c.departmentId)} followed={followed.has(c.id)} />
            ))}
          </div>
        ) : (
          <div className="space-y-1.5 px-2 sm:px-0">
            {filtered.map((c) => (
              <CourseTableRow key={c.id} course={c} faculty={facultyById.get(c.departmentId)} followed={followed.has(c.id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
