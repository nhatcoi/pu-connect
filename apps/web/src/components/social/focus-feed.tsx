'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useVirtualizer, defaultRangeExtractor } from '@tanstack/react-virtual'
import { ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import type { PostItem } from '@pu/schemas'
import { FocusFeedCard } from './focus-feed-card'

interface FocusFeedProps {
  posts: PostItem[]
  hasMore: boolean
  loadingMore: boolean
  loadMoreError: boolean
  fetchMore: () => void
  initialPostId: string | null
  onActivePost: (id: string) => void
}

// Fixed-size virtual pages: only the active post and its neighbours mount.
// Snap dọc nằm trong vùng riêng, không khóa cuộn của dialog.
export function FocusFeed({ posts, hasMore, loadingMore, loadMoreError, fetchMore, initialPostId, onActivePost }: FocusFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(600)
  const [activeId, setActiveId] = useState(initialPostId ?? posts[0]?.id)
  const activeIndex = Math.max(
    0,
    posts.findIndex((post) => post.id === activeId)
  )
  const initialIndex = useRef(
    Math.max(
      0,
      posts.findIndex((post) => post.id === initialPostId)
    )
  )
  const virtualizer = useVirtualizer({
    count: posts.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => height,
    overscan: 1,
    getItemKey: (index) => posts[index].id,
    rangeExtractor: (range) => Array.from(new Set([...defaultRangeExtractor(range), Math.min(initialIndex.current, posts.length - 1)])).sort((a, b) => a - b)
  })
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => setHeight(el.clientHeight || 600)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  useLayoutEffect(() => {
    virtualizer.measure()
    virtualizer.scrollToIndex(initialIndex.current, { align: 'start' })
  }, [height, virtualizer])
  useEffect(() => {
    if (activeIndex >= posts.length - 3 && hasMore && !loadingMore && !loadMoreError) fetchMore()
  }, [activeIndex, posts.length, hasMore, loadingMore, loadMoreError, fetchMore])
  useEffect(() => {
    if (posts.length && !posts.some((post) => post.id === activeId)) {
      setActiveId(posts[0].id)
      onActivePost(posts[0].id)
    }
  }, [posts, activeId, onActivePost])
  const move = (delta: number) => {
    const index = Math.max(0, Math.min(posts.length - 1, activeIndex + delta))
    const id = posts[index]?.id
    if (!id) return
    initialIndex.current = index
    setActiveId(id)
    onActivePost(id)
    virtualizer.scrollToIndex(index, { align: 'start' })
  }
  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        tabIndex={0}
        role="region"
        aria-label="Bảng tin tập trung, dùng phím mũi tên lên xuống để chuyển bài"
        className="h-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain no-scrollbar outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            move(e.key === 'ArrowDown' ? 1 : -1)
          }
        }}
        onScroll={(e) => {
          const index = Math.max(0, Math.min(posts.length - 1, Math.round(e.currentTarget.scrollTop / height)))
          const id = posts[index]?.id
          if (id) {
            initialIndex.current = index
            setActiveId(id)
            onActivePost(id)
          }
        }}
      >
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => (
            <div
              key={item.key}
              className="absolute left-0 top-0 w-full snap-start snap-always md:pb-3"
              style={{ height, transform: `translateY(${item.start}px)` }}
            >
              <FocusFeedCard post={posts[item.index]} active={posts[item.index].id === activeId} />
            </div>
          ))}
        </div>
      </div>
      <div className="absolute right-2 top-3 hidden gap-2 md:flex">
        <button
          disabled={activeIndex === 0}
          onClick={() => move(-1)}
          className="rounded-full bg-background/90 p-2 text-foreground disabled:opacity-30"
          aria-label="Bài trước"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
        <button
          disabled={activeIndex === posts.length - 1}
          onClick={() => move(1)}
          className="rounded-full bg-background/90 p-2 text-foreground disabled:opacity-30"
          aria-label="Bài tiếp theo"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>
      <span className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-background/90 px-2 py-1 text-xs text-muted-foreground">
        {activeIndex + 1} / {posts.length}
        {!hasMore && ' · Đã hết bài'}
      </span>
      {loadMoreError && (
        <button onClick={fetchMore} className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background px-4 py-2 text-sm text-primary shadow">
          Tải thêm thất bại · Thử lại
        </button>
      )}
      {loadingMore && <Loader2 className="absolute left-1/2 bottom-2 h-5 w-5 animate-spin text-primary" aria-label="Đang tải thêm" />}
    </div>
  )
}
