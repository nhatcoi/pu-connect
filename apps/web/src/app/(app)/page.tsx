'use client'

import React, { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, MessageSquarePlus, Compass } from 'lucide-react'
import { SlidingTabs } from '@/components/navigation/sliding-tabs'
import { AcademicPostComposer } from '@/components/social/composer/academic-post-composer'
import { FeedSkeleton } from '@/components/skeletons/feed-skeleton'
import { PostCard } from '@/components/social/post-card'
import { VirtualPostList } from '@/components/social/virtual-post-list'
import { Button } from '@/components/ui/button'
import { usePosts, prefetchFeed } from '@/hooks/use-posts'
import { useNewPosts } from '@/hooks/use-new-posts'
import { NewPostsPill } from '@/components/social/new-posts-pill'
import { FollowSuggestionsDialog } from '@/components/social/follow-suggestions-dialog'
import { useFeatureEnabled } from '@/hooks/use-settings'
import { useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/store'
import type { FeedViewMode } from '@pu/schemas'
import { useFeedViewMode } from '@/hooks/use-feed-view-mode'
import { FeedModeSwitch } from '@/components/social/feed-mode-switch'
import { FocusFeed } from '@/components/social/focus-feed'

type HomeFeedTab = 'for_you' | 'following' | 'qa'

function HomeContent() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const { mode, setMode } = useFeedViewMode()
  const activePost = useRef<string | null>(null)
  const [restorePostId, setRestorePostId] = useState<string | null>(null)
  const switchMode = (next: FeedViewMode) => {
    if (next === mode) return
    if (mode === 'list') {
      const articles = Array.from(document.querySelectorAll<HTMLElement>('[data-track-post]'))
      const current =
        articles.find((el) => {
          const box = el.getBoundingClientRect()
          return box.top < window.innerHeight / 2 && box.bottom > window.innerHeight / 2
        }) ?? articles.find((el) => el.getBoundingClientRect().bottom > 100)
      activePost.current = current?.dataset.trackPost ?? null
    }
    setRestorePostId(activePost.current)
    setMode(next)
  }

  const [activeFeedTab, setActiveFeedTab] = useState<HomeFeedTab>('for_you')

  useEffect(() => {
    if (tabParam === 'following') {
      setActiveFeedTab('following')
    } else if (tabParam === 'qa') {
      setActiveFeedTab('qa')
    } else if (!tabParam || tabParam === 'for_you') {
      setActiveFeedTab('for_you')
    }
  }, [tabParam])

  const {
    posts,
    isLoading: isPostsLoading,
    isLoadingMore,
    hasMore,
    fetchMore,
    newSince,
    isError: isPostsError,
    isLoadMoreError,
    refetch
  } = usePosts({
    feedType: activeFeedTab
  })
  // Pill "bài mới" (polling + socket); tắt trong Cài đặt ⇒ since = null ⇒ dừng polling
  const showNewPostsPill = useFeatureEnabled('newPostsPill')
  const newPosts = useNewPosts(activeFeedTab, null, showNewPostsPill ? newSince : null)

  const queryClient = useQueryClient()
  const setCreatePostOpen = useAppStore((state) => state.setCreatePostOpen)
  // Modal "Khám phá thêm" (gợi ý theo dõi) — mở từ cuối / trạng thái trống của tab Đang theo dõi
  const [exploreOpen, setExploreOpen] = useState(false)
  const isFollowingTab = activeFeedTab === 'following'

  // Infinite Scroll Sentinel Observer
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isPostsLoading) {
          fetchMore()
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    )

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current)
    }

    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, isPostsLoading, fetchMore, mode])

  const toolbar = (
    <div className="flex min-h-12 items-center justify-between gap-1 px-2 sm:px-1">
      <div className="min-w-0 flex-1 overflow-x-auto no-scrollbar">
        <SlidingTabs
          className="gap-3 sm:gap-6"
          value={activeFeedTab}
          onChange={(tab) => {
            activePost.current = null
            setRestorePostId(null)
            setActiveFeedTab(tab)
          }}
          onItemHover={(id) => prefetchFeed(queryClient, id)}
          items={[
            { id: 'for_you', label: 'Dành cho bạn' },
            { id: 'following', label: 'Đang theo dõi' },
            { id: 'qa', label: 'Hỏi đáp' }
          ]}
        />
      </div>
      <FeedModeSwitch mode={mode} onChange={switchMode} />
    </div>
  )

  if (mode === 'focus')
    return (
      <div className="fixed inset-x-0 top-0 bottom-14 z-30 flex min-h-0 flex-col bg-surface text-foreground md:bottom-0">
        <div className="z-10 shrink-0 bg-surface">{toolbar}</div>
        {isPostsLoading ? (
          <div className="mx-auto w-full max-w-3xl overflow-hidden">
            <FeedSkeleton />
          </div>
        ) : posts.length > 0 ? (
          <FocusFeed
            key={activeFeedTab}
            posts={posts}
            hasMore={hasMore}
            loadingMore={isLoadingMore}
            loadMoreError={isLoadMoreError}
            fetchMore={fetchMore}
            initialPostId={restorePostId}
            onActivePost={(id) => {
              activePost.current = id
            }}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm text-muted-foreground">{isPostsError ? 'Không tải được bảng tin.' : 'Chưa có bài viết trong bảng tin này.'}</p>
            <Button
              onClick={() => {
                if (isPostsError) void refetch()
                else if (isFollowingTab) setExploreOpen(true)
                else setCreatePostOpen(true)
              }}
            >
              {isPostsError ? 'Thử lại' : isFollowingTab ? 'Khám phá người để theo dõi' : 'Tạo bài viết'}
            </Button>
          </div>
        )}
        <FollowSuggestionsDialog open={exploreOpen} onOpenChange={setExploreOpen} />
      </div>
    )

  return (
    <>
      <div className="sticky top-0 md:top-14 z-30 bg-surface/90 backdrop-blur-md">{toolbar}</div>

      {showNewPostsPill && (
        <NewPostsPill count={newPosts.count} authors={newPosts.authors} isRevealing={newPosts.isRevealing} onClick={() => void newPosts.reveal()} />
      )}

      {/* Ô soạn bài dạng thẻ (Composer card) */}
      <div className="mx-2 sm:mx-0 mb-2.5 rounded-xl bg-card px-4 py-3">
        <AcademicPostComposer />
      </div>

      {/* Danh sách bài viết dạng thẻ, cách nhau bằng khoảng trống */}
      <div className="space-y-2.5 px-2 sm:px-0">
        {isPostsLoading ? (
          <FeedSkeleton />
        ) : posts.length > 0 ? (
          <>
            {/* Ảo hóa: chỉ các bài gần màn hình nằm trong DOM */}
            <VirtualPostList
              posts={posts}
              initialPostId={restorePostId}
              cacheKey={`feed:${activeFeedTab}`}
              renderPost={(post) => <PostCard post={post} variant="card" />}
            />

            {/* Infinite Scroll Bottom Sentinel */}
            <div ref={sentinelRef} className="py-6 text-center">
              {isLoadingMore ? (
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-foreground" />
                  <span>Đang nạp thêm bài viết phù hợp...</span>
                </div>
              ) : !hasMore && isFollowingTab ? (
                // Hết bài từ người theo dõi ⇒ mời khám phá thêm người mới
                <div className="flex flex-col items-center gap-3 rounded-xl bg-card px-6 py-6">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Bạn đã xem hết bài từ người đang theo dõi</p>
                    <p className="text-xs text-muted-foreground">Theo dõi thêm bạn cùng lớp, cùng khoa để bảng tin phong phú hơn.</p>
                  </div>
                  <Button size="sm" onClick={() => setExploreOpen(true)} className="h-9 gap-1.5 rounded-full px-5 text-xs font-semibold cursor-pointer">
                    <Compass className="h-4 w-4" />
                    Khám phá thêm
                  </Button>
                </div>
              ) : !hasMore && posts.length > 5 ? (
                <div className="flex items-center justify-center gap-1.5 py-4 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Bạn đã xem hết các bài viết mới nhất</span>
                </div>
              ) : null}
            </div>
          </>
        ) : isPostsError ? (
          <div className="py-12 text-center">
            <p className="mb-3 text-sm text-muted-foreground">Không tải được bảng tin.</p>
            <Button onClick={() => void refetch()}>Thử lại</Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 m-3 sm:m-0 text-center">
            <MessageSquarePlus className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h3 className="text-sm font-bold text-foreground">
              {activeFeedTab === 'following'
                ? 'Chưa có bài viết từ người bạn theo dõi'
                : activeFeedTab === 'qa'
                  ? 'Chưa có câu hỏi học thuật nào'
                  : 'Chưa có bài viết nào'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-sm mx-auto leading-relaxed">
              {activeFeedTab === 'following'
                ? 'Hãy bấm theo dõi các Giảng viên, Trợ giảng hoặc bạn bè sinh viên cùng khoa để nhận bài viết mới nhất của họ tại đây!'
                : activeFeedTab === 'qa'
                  ? 'Hãy là người đầu tiên đặt câu hỏi thắc mắc về bài tập, môn học hoặc đồ án để nhận lời giải chuẩn!'
                  : 'Hãy là người đầu tiên chia sẻ kiến thức, kinh nghiệm học tập hoặc tài liệu học phần!'}
            </p>
            {isFollowingTab ? (
              <Button
                size="sm"
                onClick={() => setExploreOpen(true)}
                className="gap-1.5 bg-primary text-primary-foreground font-bold rounded-full cursor-pointer"
              >
                <Compass className="h-4 w-4" />
                Khám phá người để theo dõi
              </Button>
            ) : (
              <Button size="sm" onClick={() => setCreatePostOpen(true)} className="bg-primary text-primary-foreground font-bold rounded-full cursor-pointer">
                {activeFeedTab === 'qa' ? 'Đặt câu hỏi ngay' : 'Tạo bài viết mới'}
              </Button>
            )}
          </div>
        )}
      </div>

      <FollowSuggestionsDialog open={exploreOpen} onOpenChange={setExploreOpen} />
    </>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <HomeContent />
    </Suspense>
  )
}
