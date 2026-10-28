'use client'

import React from 'react'
import Link from 'next/link'
import type { DocCategory } from '@pu/schemas'
import { useFollowedCourseIds } from '@/hooks/use-course-follow'
import { useDocumentBrowse } from '@/hooks/use-document-library'
import { useAppStore } from '@/store'
import { CardListSkeleton } from '@/components/skeletons/catalog-skeleton'
import { useCollections } from '@/hooks/use-document-community'
import { CollectionCard } from './collection-card'
import { DocumentShelf } from './document-shelf'

const SHELF_SIZE = 12

export interface DiscoverSeeAll {
  category?: DocCategory
  sort?: 'popular' | 'newest'
  course?: string
}

// Trang khám phá: các kệ ngang (theo dõi / hot / mới / đề thi / slide). Kệ rỗng tự ẩn
export function DocumentsDiscover({ onSeeAll }: { onSeeAll: (target: DiscoverSeeAll) => void }) {
  const user = useAppStore((s) => s.user)
  const { data: followed = [] } = useFollowedCourseIds()
  const followedFilter = user && followed.length ? followed.join(',') : undefined

  const mine = useDocumentBrowse({ course: followedFilter, sort: 'newest' }, !!followedFilter)
  const hot = useDocumentBrowse({ sort: 'popular' })
  const fresh = useDocumentBrowse({ sort: 'newest' })
  const finals = useDocumentBrowse({ category: 'final_exam', sort: 'popular' })
  const slides = useDocumentBrowse({ category: 'lecture_slide', sort: 'popular' })

  const collections = useCollections('public')
  const all = [mine, hot, fresh, finals, slides]
  const loading = all.every((q) => q.isPending && q.fetchStatus !== 'idle')
  const empty = all.every((q) => (q.isPending ? q.fetchStatus === 'idle' : q.items.length === 0))

  if (loading) return <CardListSkeleton label="Đang tải tài liệu" />
  if (empty) {
    return (
      <div className="space-y-1 py-16 text-center text-muted-foreground">
        <p className="text-sm font-medium">Chưa có tài liệu nào trong kho</p>
        <p className="text-xs">Tải đề thi, slide lên và bật “Đưa vào kho môn học” để mọi người tìm thấy.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {followedFilter && <DocumentShelf title="Từ môn bạn theo dõi" hint="Tài liệu mới nhất của các môn bạn đang theo dõi" items={mine.items.slice(0, SHELF_SIZE)} onSeeAll={() => onSeeAll({ course: followedFilter, sort: 'newest' })} />}
      <DocumentShelf title="Đang được dùng nhiều" hint="Nhiều lượt tải và lưu nhất" items={hot.items.slice(0, SHELF_SIZE)} onSeeAll={() => onSeeAll({ sort: 'popular' })} />
      <DocumentShelf title="Vừa đăng" hint="Mới được chia sẻ vào kho" items={fresh.items.slice(0, SHELF_SIZE)} onSeeAll={() => onSeeAll({ sort: 'newest' })} />
      {collections.items.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-end justify-between gap-3 px-2 sm:px-0">
            <div>
              <h2 className="text-[15px] font-bold tracking-tight">Bộ sưu tập nổi bật</h2>
              <p className="text-xs text-muted-foreground">Tài liệu được bạn bè gom theo chủ đề ôn tập</p>
            </div>
            <Link href="/courses?tab=collections" className="text-xs font-semibold text-primary hover:underline">
              Xem tất cả
            </Link>
          </div>
          <div className="flex snap-x gap-3 overflow-x-auto px-2 pb-2 sm:px-0 [scrollbar-width:none]">
            {collections.items.slice(0, SHELF_SIZE).map((c) => (
              <CollectionCard key={c.id} collection={c} className="w-[220px] shrink-0 snap-start" />
            ))}
          </div>
        </section>
      )}
      <DocumentShelf title="Đề cuối kỳ" hint="Ôn thi với đề các năm trước" items={finals.items.slice(0, SHELF_SIZE)} onSeeAll={() => onSeeAll({ category: 'final_exam' })} />
      <DocumentShelf title="Slide bài giảng" hint="Slide theo từng môn" items={slides.items.slice(0, SHELF_SIZE)} onSeeAll={() => onSeeAll({ category: 'lecture_slide' })} />
    </div>
  )
}
