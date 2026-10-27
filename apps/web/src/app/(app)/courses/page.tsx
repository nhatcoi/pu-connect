'use client'

import React, { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { FileText, GraduationCap, MessageSquare, Search } from 'lucide-react'
import { useCourses } from '@/hooks/use-course'
import { Input } from '@/components/ui/input'
import { CourseListSkeleton } from '@/components/skeletons/catalog-skeleton'
import { PageAside } from '@/components/layout/page-aside'
import { CoursesAside } from '@/components/courses/courses-aside'
import { SlidingTabs } from '@/components/navigation/sliding-tabs'
import { DocumentsBrowse } from '@/components/documents/documents-browse'
import { LibraryPanel } from '@/components/documents/library-panel'

type Tab = 'courses' | 'documents' | 'library'
const TABS: { id: Tab; label: string }[] = [
  { id: 'courses', label: 'Môn học' },
  { id: 'documents', label: 'Tài liệu' },
  { id: 'library', label: 'Kho của tôi' }
]

// Bỏ dấu tiếng Việt để tìm "giai tich" khớp "Giải tích"
const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

// /courses — "Môn học & Tài liệu": danh mục môn, kho tài liệu chung, kho cá nhân (?tab=documents|library)
export default function CoursesPage() {
  return (
    <Suspense fallback={<CourseListSkeleton />}>
      <CoursesHub />
    </Suspense>
  )
}

function CoursesHub() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'courses') as Tab
  const setTab = (next: Tab) => router.replace(next === 'courses' ? pathname : `${pathname}?tab=${next}`, { scroll: false })

  return (
    <>
      <PageAside>
        <CoursesAside />
      </PageAside>

      <div className="sticky top-0 md:top-14 z-30 bg-surface/90 backdrop-blur-md px-4 pt-3 space-y-1">
        <h1 className="text-[15px] font-semibold tracking-tight flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-primary" /> Môn học & Tài liệu
        </h1>
        <SlidingTabs<Tab> value={tab} onChange={setTab} items={TABS} />
      </div>

      <div className="pt-2">
        {tab === 'courses' && <CourseCatalog />}
        {tab === 'documents' && <DocumentsBrowse />}
        {tab === 'library' && <LibraryPanel />}
      </div>
    </>
  )
}

// Danh mục môn học: tìm theo mã / tên, mở trang môn
function CourseCatalog() {
  const { data: courses = [], isPending } = useCourses()
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const needle = normalize(q.trim())
    if (!needle) return courses
    return courses.filter((c) => normalize(`${c.code} ${c.name}`).includes(needle))
  }, [courses, q])

  return (
    <div className="space-y-2.5">
      <div className="relative mx-2 sm:mx-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo mã hoặc tên môn (vd. IT101, giải tích)" className="pl-9 rounded-full h-9 text-sm" />
      </div>

      {isPending ? (
        <CourseListSkeleton />
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Không tìm thấy môn học phù hợp.</p>
      ) : (
        <div className="px-2 sm:px-0 space-y-2">
          {filtered.map((course) => (
            <Link
              key={course.id}
              href={`/courses/${encodeURIComponent(course.code)}`}
              className="block rounded-xl bg-card px-4 py-3 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-primary/10 px-2 py-0.5 font-bold text-xs text-primary font-mono">{course.code}</span>
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
    </div>
  )
}
