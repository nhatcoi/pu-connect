'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useWindowVirtualizer, type VirtualItem } from '@tanstack/react-virtual'
import type { PostItem } from '@pu/schemas'

// Kích thước đã đo của từng danh sách (theo khóa feed) — quay lại trang khôi phục đúng chiều cao
// ⇒ trình duyệt trả lại đúng vị trí cuộn dù chỉ render vài bài
const measurementSnapshots = new Map<string, VirtualItem[]>()

interface VirtualPostListProps {
  posts: PostItem[]
  initialPostId?: string | null
  // Khóa duy nhất của danh sách (vd. feed:for_you, community:slug:hot)
  cacheKey: string
  renderPost: (post: PostItem) => React.ReactNode
  gap?: number
  estimateSize?: number
}

// Danh sách bài ảo hóa theo cửa sổ: chỉ ~10–20 bài gần màn hình nằm trong DOM
// (feed dài không làm nặng trang / tràn bộ nhớ trên điện thoại)
export function VirtualPostList({ posts, cacheKey, renderPost, initialPostId, gap = 10, estimateSize = 420 }: VirtualPostListProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const [scrollMargin, setScrollMargin] = useState(0)

  // Khoảng cách từ đầu trang tới danh sách (composer, tab… phía trên)
  useLayoutEffect(() => {
    const el = listRef.current
    if (!el) return
    const update = () => setScrollMargin(el.getBoundingClientRect().top + window.scrollY)
    update()
    const ro = new ResizeObserver(update)
    if (el.parentElement) ro.observe(el.parentElement)
    return () => ro.disconnect()
  }, [])

  const virtualizer = useWindowVirtualizer({
    count: posts.length,
    estimateSize: () => estimateSize,
    overscan: 4,
    gap,
    scrollMargin,
    getItemKey: (index) => posts[index]?.id ?? index,
    initialMeasurementsCache: measurementSnapshots.get(cacheKey)
  })

  const restored = useRef(false)
  useEffect(() => {
    if (restored.current || !initialPostId) return
    const frame = requestAnimationFrame(() => {
      const index = posts.findIndex((post) => post.id === initialPostId)
      if (index >= 0) {
        virtualizer.scrollToIndex(index, { align: 'start' })
        restored.current = true
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [initialPostId, posts, virtualizer])

  // Lưu kích thước đã đo khi rời trang / đổi danh sách
  useEffect(() => {
    return () => {
      const snapshot = virtualizer.takeSnapshot()
      if (snapshot.length) measurementSnapshots.set(cacheKey, snapshot)
    }
  }, [cacheKey, virtualizer])

  const items = virtualizer.getVirtualItems()

  return (
    <div ref={listRef} style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
      {items.map((item) => {
        const post = posts[item.index]
        if (!post) return null
        return (
          <div
            key={item.key}
            data-index={item.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)`
            }}
          >
            {renderPost(post)}
          </div>
        )
      })}
    </div>
  )
}
