'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { FolderOpen, Loader2 } from 'lucide-react'
import { DropZone } from '@/components/chat/composer/drop-zone'
import { buildEntries, FILTERS, KIND_META, matches, type LibEntry, type LibFilter } from '@/components/n7ai/library/library-model'
import { LibraryEntries, LibraryToolbar, StudyDialog, type EntryActions, type LibView } from '@/components/n7ai/library/library-view'
import { AddSourceMenu } from '@/components/n7ai/sources/add-source-menu'
import { openDoc } from '@/components/n7ai/sources/source-view-store'
import { useAddSources } from '@/components/n7ai/sources/use-add-sources'
import { N7AiPageHeader } from '@/components/n7ai/n7ai-page-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAiLibrary } from '@/hooks/chat'

const VIEW_KEY = 'n7ai-library-view'
const readView = (): LibView => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'list'
  } catch {
    return 'list'
  }
}

// /n7ai/library: mọi thứ của bạn ở N7AI trong một danh sách — tài liệu, ảnh, liên kết, video, ghi chú, học liệu; lọc theo loại, tìm, xem dạng danh sách hoặc thẻ
export default function N7AiLibraryPage() {
  const adder = useAddSources() // thêm trực tiếp vào thư viện, không thuộc cuộc trò chuyện nào
  const files = useAiLibrary('file')
  const images = useAiLibrary('image')
  const study = useAiLibrary('study')
  const [filter, setFilter] = useState<LibFilter>('all')
  const [query, setQuery] = useState('')
  const [view, setView] = useState<LibView>('list')
  const [studyOpen, setStudyOpen] = useState<LibEntry | null>(null)
  useEffect(() => setView(readView()), [])
  const changeView = (v: LibView) => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      // không lưu được thì thôi, chỉ mất ghi nhớ
    }
  }

  const entries = useMemo(() => buildEntries(adder.sources, files.items, images.items, study.items), [adder.sources, files.items, images.items, study.items])
  const q = query.trim().toLowerCase()
  const shown = useMemo(() => entries.filter((e) => matches(e, filter, q)), [entries, filter, q])
  const counts = useMemo(() => {
    const byQuery = entries.filter((e) => matches(e, 'all', q))
    return Object.fromEntries(FILTERS.map((f) => [f, f === 'all' ? byQuery.length : byQuery.filter((e) => e.kind === f).length])) as Record<LibFilter, number>
  }, [entries, q])

  const pending = adder.isPending || files.isPending || images.isPending || study.isPending
  const queries = [files, images, study]
  const loadingMore = queries.some((x) => x.isFetchingNextPage)
  const hasMore = queries.some((x) => x.hasNextPage)

  // Cuộn gần cuối ⇒ tải tiếp mọi nguồn còn trang
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore) return
    const observer = new IntersectionObserver(
      (e) => {
        if (!e[0].isIntersecting) return
        for (const x of [files, images, study]) if (x.hasNextPage && !x.isFetchingNextPage) void x.fetchNextPage()
      },
      { rootMargin: '300px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, files, images, study])

  const actions: EntryActions = {
    onOpen: (e) => (e.doc ? openDoc(e.doc) : setStudyOpen(e)),
    onRemove: (e) => e.source && adder.remove(e.source.id),
    onSaveToKho: (e) => e.source && adder.saveToLibrary(e.source.id)
  }

  return (
    <DropZone label="Thả để thêm vào thư viện" onFiles={(f) => void adder.addFiles(f)} onAttachment={adder.addAttachment} tall className="pb-6">
      <N7AiPageHeader
        title="Thư viện"
        description="Mọi tài liệu, ảnh, liên kết và học liệu của bạn ở N7AI"
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs">
              <Link href="/documents?tab=library">Kho của tôi</Link>
            </Button>
            <AddSourceMenu adder={adder} inThread={false} />
          </div>
        }
      />
      <LibraryToolbar filter={filter} onFilter={setFilter} counts={counts} query={query} onQuery={setQuery} view={view} onView={changeView} />

      <div className="px-3 sm:px-1">
        {adder.uploading.length > 0 && (
          <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải lên {adder.uploading.map((u) => u.name).join(', ')}
          </p>
        )}
        {pending ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : !shown.length ? (
          <div className="space-y-2 py-16 text-center text-muted-foreground">
            <FolderOpen className="mx-auto h-10 w-10 text-primary opacity-30" />
            <p className="text-sm">
              {q ? 'Không có mục nào khớp.' : filter === 'all' ? 'Thư viện còn trống. Kéo tệp vào đây hoặc bấm “Thêm tài liệu”.' : `Chưa có ${KIND_META[filter].label.toLowerCase()} nào.`}
            </p>
          </div>
        ) : (
          <LibraryEntries entries={shown} view={view} actions={actions} />
        )}
        <div ref={sentinel} aria-hidden />
        {loadingMore && <Loader2 className="mx-auto mt-3 h-4 w-4 animate-spin text-muted-foreground" aria-label="Đang tải thêm" />}
      </div>
      <StudyDialog entry={studyOpen} onClose={() => setStudyOpen(null)} />
    </DropZone>
  )
}
