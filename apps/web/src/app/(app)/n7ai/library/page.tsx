'use client'

import React, { useEffect, useRef, useState } from 'react'
import { FolderOpen, Loader2 } from 'lucide-react'
import type { AiLibraryKind } from '@pu/schemas'
import { DropZone } from '@/components/chat/composer/drop-zone'
import { DocRow } from '@/components/n7ai/side-panel/panel-docs'
import { entryFromSource } from '@/components/n7ai/sources/doc-entries'
import { AddSourceMenu } from '@/components/n7ai/sources/add-source-menu'
import { useAddSources } from '@/components/n7ai/sources/use-add-sources'
import { N7AiPageHeader } from '@/components/n7ai/n7ai-page-header'
import { LibraryFiles, LibraryImages, LibraryStudy } from '@/components/n7ai/library/library-items'
import { Skeleton } from '@/components/ui/skeleton'
import { useAiLibrary } from '@/hooks/chat'
import { cn } from '@/lib/utils'

const TABS: { id: AiLibraryKind; label: string; empty: string }[] = [
  { id: 'file', label: 'Tài liệu', empty: 'Chưa có tài liệu. Kéo tệp vào đây hoặc bấm “Thêm tài liệu”.' },
  { id: 'image', label: 'Ảnh', empty: 'Chưa gửi ảnh nào cho N7AI.' },
  { id: 'study', label: 'Học liệu', empty: 'Nhờ N7AI tạo quiz hoặc flashcard — chúng sẽ được lưu ở đây.' }
]

// /n7ai/library: tài liệu (mặc định), ảnh đã gửi & quiz / flashcard N7AI tạo, gom từ mọi cuộc trò chuyện
export default function N7AiLibraryPage() {
  const [tab, setTab] = useState<AiLibraryKind>('file')
  const meta = TABS.find((t) => t.id === tab)!
  const { items, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } = useAiLibrary(tab)
  const adder = useAddSources() // thư viện: tài liệu thêm trực tiếp, không thuộc cuộc trò chuyện nào
  const added = tab === 'file' ? adder.sources : []
  // Tệp đã thêm vào thư viện không hiện lại ở danh sách tệp đã gửi
  const addedKeys = new Set(added.flatMap((s) => (s.attachment ? [s.attachment.key] : [])))
  const sentFiles = tab === 'file' ? items.map((i) => ({ ...i, attachments: i.attachments.filter((a) => !addedKeys.has(a.key)) })).filter((i) => i.attachments.length) : items

  // Cuộn gần cuối ⇒ tải trang tiếp
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasNextPage) return
    const observer = new IntersectionObserver((e) => e[0].isIntersecting && !isFetchingNextPage && void fetchNextPage(), { rootMargin: '300px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <DropZone label="Thả để thêm vào thư viện" onFiles={(files) => void adder.addFiles(files)} onAttachment={adder.addAttachment} tall className="pb-6">
      <N7AiPageHeader
        title="Thư viện"
        description="Tài liệu, ảnh và học liệu trong các cuộc trò chuyện với N7AI"
        actions={<AddSourceMenu adder={adder} inThread={false} />}
      />
      <div className="flex gap-1.5 px-3 pb-3 sm:px-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'h-7 px-3 rounded-full text-xs font-medium cursor-pointer transition-colors',
              tab === t.id ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-2 sm:px-0">
        {added.length > 0 && (
          <section className="mb-4 space-y-1.5">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Đã thêm vào thư viện</p>
            {added.map((s) => (
              <DocRow key={s.id} entry={entryFromSource(s)} onRemove={() => adder.remove(s.id)} />
            ))}
          </section>
        )}
        {isPending ? (
          <div className={tab === 'image' ? 'grid grid-cols-3 gap-1 sm:grid-cols-4' : 'space-y-2'}>
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className={tab === 'image' ? 'aspect-square' : 'h-16 rounded-xl'} />
            ))}
          </div>
        ) : !items.length && !added.length ? (
          <div className="py-16 text-center text-muted-foreground space-y-2">
            <FolderOpen className="h-10 w-10 mx-auto opacity-30 text-primary" />
            <p className="text-sm">{meta.empty}</p>
          </div>
        ) : tab === 'image' ? (
          <LibraryImages items={items} />
        ) : tab === 'file' ? (
          sentFiles.length > 0 && <LibraryFiles items={sentFiles} />
        ) : (
          <LibraryStudy items={items} />
        )}
        <div ref={sentinel} aria-hidden />
        {isFetchingNextPage && <Loader2 className="mx-auto mt-3 h-4 w-4 animate-spin text-muted-foreground" aria-label="Đang tải thêm" />}
      </div>
    </DropZone>
  )
}
