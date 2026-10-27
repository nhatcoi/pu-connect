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
import { DocumentRow } from './document-row'

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

  // Gõ xong 300ms mới tìm
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 300)
    return () => clearTimeout(t)
  }, [input])

  const browse = useDocumentBrowse({ q: q || undefined, course: courseCode || course || undefined, category: category || undefined, sort })
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
            <select aria-label="Môn học" value={course} onChange={(e) => setCourse(e.target.value)} className={cn(SELECT, 'max-w-[220px]')}>
              <option value="">Mọi môn</option>
              {courses.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.code} · {c.name}
                </option>
              ))}
            </select>
          )}
          <select aria-label="Sắp xếp" value={sort} onChange={(e) => setSort(e.target.value as 'popular' | 'newest')} className={SELECT}>
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

      {browse.isPending ? (
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
        <div className="space-y-1.5 px-2 sm:px-0">
          {browse.items.map((doc) => (
            <DocumentRow key={doc.id} document={doc} />
          ))}
        </div>
      )}
      <div ref={sentinel} className="flex h-10 items-center justify-center">
        {isFetchingNextPage && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
      </div>
    </div>
  )
}
