'use client'

import React, { useEffect, useState } from 'react'
import { DOC_CATEGORIES, DOC_CATEGORY_LABELS, type DocCategory } from '@pu/schemas'
import { FileText, Loader2, Plus, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CardListSkeleton } from '@/components/skeletons/catalog-skeleton'
import { useCourses } from '@/hooks/use-course'
import { useDocumentBrowse } from '@/hooks/use-document-library'
import { useLoadMore } from '@/hooks/use-load-more'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { CourseSelect } from './course-select'
import { DocumentCard } from './document-card'
import { DocumentsDiscover } from './documents-discover'

const SELECT = 'h-8 min-w-0 rounded-full border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer'

// Tab "Tài liệu": kho chung (tài liệu đã phân loại), lọc môn / loại / từ khóa. courseCode = cố định 1 môn (trang môn học)
export function DocumentsBrowse({ courseCode }: { courseCode?: string } = {}) {
  const { data: courses = [] } = useCourses()
  const setCreateDocumentOpen = useAppStore((s) => s.setCreateDocumentOpen)
  const [input, setInput] = useState('')
  const [q, setQ] = useState('')
  const [course, setCourse] = useState('')
  const [category, setCategory] = useState<DocCategory | ''>('')
  const [sort, setSort] = useState<'popular' | 'newest'>('popular')
  // Đã chủ động đổi sắp xếp / bấm "Xem tất cả" ⇒ thoát chế độ khám phá
  const [sorted, setSorted] = useState(false)
  // Nhiều môn từ kệ "môn bạn theo dõi" (CourseSelect chỉ chọn 1 môn)
  const [followedCourses, setFollowedCourses] = useState('')

  // Gõ xong 300ms mới tìm
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 300)
    return () => clearTimeout(t)
  }, [input])

  // Chưa lọc gì (và không khóa 1 môn) ⇒ trang khám phá dạng kệ; có lọc ⇒ lưới kết quả
  const discovering = !courseCode && !q && !course && !followedCourses && !category && !sorted
  const browse = useDocumentBrowse({ q: q || undefined, course: courseCode || followedCourses || course || undefined, category: category || undefined, sort }, !discovering)
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = browse
  const sentinel = useLoadMore(!!hasNextPage && !isFetchingNextPage, () => void fetchNextPage())

  return (
    <div className="space-y-2.5">
      <div className="mx-2 sm:mx-0 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Tìm tài liệu, đề thi, slide…" className="h-9 rounded-full pl-9 text-sm" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!courseCode && (
            <CourseSelect courses={courses} value={course} onChange={(v) => { setCourse(v); setFollowedCourses('') }} valueBy="code" placeholder="Mọi môn" className="h-8 max-w-[220px] rounded-full px-3" />
          )}
          {followedCourses && <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Môn bạn theo dõi</span>}
          {!discovering && !courseCode && (
            <button type="button" onClick={() => { setInput(''); setQ(''); setCourse(''); setFollowedCourses(''); setCategory(''); setSort('popular'); setSorted(false) }} className="text-xs font-semibold text-primary hover:underline cursor-pointer">
              ← Khám phá
            </button>
          )}
          <select aria-label="Sắp xếp" value={sort} onChange={(e) => { setSort(e.target.value as 'popular' | 'newest'); setSorted(true) }} className={SELECT}>
            <option value="popular">Nhiều lượt tải</option>
            <option value="newest">Mới nhất</option>
          </select>
          <Button variant="outline" size="sm" className="ml-auto h-8 gap-1.5 rounded-full text-xs" onClick={() => setCreateDocumentOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Chia sẻ tài liệu
          </Button>
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {(['', ...DOC_CATEGORIES] as const).map((k) => (
            <button
              key={k || 'all'}
              type="button"
              onClick={() => setCategory(k)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors cursor-pointer',
                category === k ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {k ? DOC_CATEGORY_LABELS[k] : 'Tất cả'}
            </button>
          ))}
        </div>
      </div>

      {discovering ? (
        <DocumentsDiscover
          onSeeAll={(t) => {
            setCategory(t.category ?? '')
            setCourse('')
            setFollowedCourses(t.course ?? '')
            setSort(t.sort ?? 'popular')
            setSorted(true)
          }}
        />
      ) : browse.isPending ? (
        <CardListSkeleton label="Đang tải tài liệu" />
      ) : browse.isError ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Không tải được tài liệu. Thử lại sau nhé.</p>
      ) : browse.items.length === 0 ? (
        <div className="space-y-2 py-16 text-center text-muted-foreground">
          <FileText className="mx-auto h-10 w-10 text-primary opacity-30" />
          <p className="text-sm font-medium">Chưa có tài liệu phù hợp</p>
          <p className="text-xs">Đính kèm đề thi, slide khi đăng bài và bật “Đưa vào kho môn học” để mọi người tìm thấy.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-2 sm:grid-cols-3 sm:px-0 lg:grid-cols-4">
          {browse.items.map((doc) => (
            <DocumentCard key={doc.id} document={doc} />
          ))}
        </div>
      )}
      <div ref={sentinel} className="flex h-10 items-center justify-center">
        {isFetchingNextPage && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
      </div>
    </div>
  )
}
