'use client'

import React from 'react'
import Link from 'next/link'
import { DOC_CATEGORY_LABELS } from '@pu/schemas'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CardListSkeleton } from '@/components/skeletons/catalog-skeleton'
import { useCoursePath } from '@/hooks/use-document-community'
import { useAppStore } from '@/store'
import { DocumentCard } from './document-card'

// Tab "Lộ trình học" của môn: tài liệu theo thứ tự ôn (đề cương → giáo trình → slide → bài tập → đề thi) + đề các năm để so sánh
export function CoursePath({ courseCode, onSeeAll }: { courseCode: string; onSeeAll: () => void }) {
  const { data, isPending, isError } = useCoursePath(courseCode)
  const setCreateDocumentOpen = useAppStore((s) => s.setCreateDocumentOpen)

  if (isPending) return <CardListSkeleton label="Đang tải lộ trình học" />
  if (isError) return <p className="py-16 text-center text-sm text-muted-foreground">Không tải được lộ trình. Thử lại sau nhé.</p>
  if (data.steps.length === 0) {
    return (
      <div className="space-y-3 py-16 text-center text-muted-foreground">
        <p className="text-sm font-medium">Môn này chưa có tài liệu trong kho</p>
        <Button size="sm" className="gap-1.5 rounded-lg text-xs" onClick={() => setCreateDocumentOpen(true)}>
          <Upload className="h-3.5 w-3.5" /> Là người đầu tiên chia sẻ
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 px-2 sm:px-0">
      <ol className="relative space-y-6 border-l border-border pl-5">
        {data.steps.map((step, i) => (
          <li key={step.category} className="relative space-y-2">
            <span className="absolute -left-[27px] top-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full border border-border bg-background text-[11px] font-bold text-primary">{i + 1}</span>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-bold">
                {DOC_CATEGORY_LABELS[step.category]} <span className="font-normal text-muted-foreground">· {step.count} tài liệu</span>
              </h3>
              {step.count > step.items.length && (
                <button type="button" onClick={onSeeAll} className="text-xs font-semibold text-primary hover:underline cursor-pointer">
                  Xem tất cả
                </button>
              )}
            </div>
            <div className="flex snap-x gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
              {step.items.map((doc) => (
                <DocumentCard key={doc.id} document={doc} className="w-[200px] shrink-0 snap-start" />
              ))}
            </div>
          </li>
        ))}
      </ol>

      {data.exams.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-bold">Đề thi các năm</h3>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {data.exams.map((year) => (
              <div key={year.academicYear} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-3 py-2 last:border-b-0">
                <span className="w-20 shrink-0 text-xs font-semibold tabular-nums">{year.academicYear}</span>
                <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                  {year.documents.map((d) => (
                    <Link key={d.id} href={`/documents/${d.id}`} className="max-w-full truncate rounded-full border border-border px-2.5 py-1 text-xs hover:border-primary hover:text-primary">
                      {d.docCategory ? DOC_CATEGORY_LABELS[d.docCategory] : 'Đề thi'} · {d.title}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
