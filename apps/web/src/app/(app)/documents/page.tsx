'use client'

import React, { Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Upload } from 'lucide-react'
import { CourseListSkeleton } from '@/components/skeletons/catalog-skeleton'
import { Button } from '@/components/ui/button'
import { CourseCatalog } from '@/components/courses/course-catalog'
import { SlidingTabs } from '@/components/navigation/sliding-tabs'
import { DocumentsBrowse } from '@/components/documents/documents-browse'
import { CollectionsPanel } from '@/components/documents/collections-panel'
import { LibraryPanel } from '@/components/documents/library-panel'
import { useAppStore } from '@/store'

type Tab = 'courses' | 'documents' | 'collections' | 'library'
const TABS: { id: Tab; label: string }[] = [
  { id: 'courses', label: 'Môn học' },
  { id: 'documents', label: 'Tài liệu' },
  { id: 'collections', label: 'Bộ sưu tập' },
  { id: 'library', label: 'Kho của tôi' }
]

// /documents — "Môn học & Tài liệu": danh mục môn, kho tài liệu chung, kho cá nhân (?tab=documents|collections|library)
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
  const setCreateDocumentOpen = useAppStore((s) => s.setCreateDocumentOpen)
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'courses') as Tab
  const setTab = (next: Tab) => router.replace(next === 'courses' ? pathname : `${pathname}?tab=${next}`, { scroll: false })

  return (
    <>
      <div className="sticky top-0 md:top-14 z-30 bg-surface/90 backdrop-blur-md px-4 pt-3 space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[15px] font-semibold tracking-tight">Môn học & Tài liệu</h1>
          <Button size="sm" className="h-8 gap-1.5 rounded-lg text-xs" onClick={() => setCreateDocumentOpen(true)}>
            <Upload className="h-3.5 w-3.5" /> Tải tài liệu lên
          </Button>
        </div>
        <SlidingTabs<Tab> value={tab} onChange={setTab} items={TABS} />
      </div>

      <div className="pt-2">
        {tab === 'courses' && <CourseCatalog />}
        {tab === 'documents' && <DocumentsBrowse />}
        {tab === 'collections' && <CollectionsPanel />}
        {tab === 'library' && <LibraryPanel />}
      </div>
    </>
  )
}
