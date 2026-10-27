'use client'

import React, { Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { GraduationCap } from 'lucide-react'
import { CourseListSkeleton } from '@/components/skeletons/catalog-skeleton'
import { PageAside } from '@/components/layout/page-aside'
import { CourseCatalog } from '@/components/courses/course-catalog'
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
