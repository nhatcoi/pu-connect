'use client'

import React, { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Sparkles,
  Users,
  HelpCircle,
  Loader2,
  CheckCircle2,
  MessageSquarePlus,
  UserPlus
} from 'lucide-react'
import { Header } from '@/components/social/header'
import { Sidebar } from '@/components/social/sidebar'
import { RightSidebar } from '@/components/social/right-sidebar'
import { MobileBottomNav } from '@/components/navigation/mobile-bottom-nav'
import { AcademicPostComposer } from '@/components/social/composer/academic-post-composer'
import { PostCard } from '@/components/social/post-card'
import { CreatePostDialog } from '@/components/social/create-post-dialog'
import { CreateDocumentDialog } from '@/components/social/create-document-dialog'
import { CreateGroupDialog } from '@/components/social/create-group-dialog'
import { DocumentPreviewModal } from '@/components/viewer/document-preview-modal'
import { AuthGuard } from '@/components/auth/auth-guard'
import { Button } from '@/components/ui/button'
import { usePosts } from '@/hooks/use-posts'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'

type HomeFeedTab = 'for_you' | 'following' | 'qa'

function HomeContent() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')

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
    fetchMore
  } = usePosts({
    feedType: activeFeedTab
  })
  
  const user = useAppStore((state) => state.user)
  const isCreatePostOpen = useAppStore((state) => state.isCreatePostOpen)
  const setCreatePostOpen = useAppStore((state) => state.setCreatePostOpen)
  const isCreateDocumentOpen = useAppStore((state) => state.isCreateDocumentOpen)
  const setCreateDocumentOpen = useAppStore((state) => state.setCreateDocumentOpen)
  const isCreateGroupOpen = useAppStore((state) => state.isCreateGroupOpen)
  const setCreateGroupOpen = useAppStore((state) => state.setCreateGroupOpen)
  const previewDocument = useAppStore((state) => state.previewDocument)
  const setPreviewDocument = useAppStore((state) => state.setPreviewDocument)

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
  }, [hasMore, isLoadingMore, isPostsLoading, fetchMore])

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
        {/* Unified Top Header */}
        <Header />

        {/* Global Dialogs & Preview Modals */}
        <CreatePostDialog />
        <CreateDocumentDialog
          open={isCreateDocumentOpen}
          onOpenChange={setCreateDocumentOpen}
        />
        <CreateGroupDialog
          open={isCreateGroupOpen}
          onOpenChange={setCreateGroupOpen}
        />
        <DocumentPreviewModal
          document={previewDocument}
          open={!!previewDocument}
          onOpenChange={(open) => {
            if (!open) setPreviewDocument(null)
          }}
        />

        {/* Main 3-Column Layout (Signature X Twitter Architecture) */}
        <div className="mx-auto flex justify-center max-w-7xl px-0 sm:px-4 lg:px-6 min-h-screen">
          
          {/* 1. Left Sidebar Navigation (Icon-only on md, full on xl) */}
          <div className="hidden md:flex shrink-0 w-16 xl:w-64 sticky top-14 h-[calc(100vh-3.5rem)] py-3 flex-col justify-between z-30">
            <Sidebar />
          </div>

          {/* 2. Center Feed Column (Academic focus, clean dividing borders) */}
          <main className="flex-1 max-w-[700px] xl:max-w-[720px] w-full min-w-0 border-x border-border/80 min-h-screen pb-20 md:pb-12">
            
            {/* ── X-Style Sticky 3-Tab Feed Filter Bar ── */}
            <div className="sticky top-0 md:top-14 z-30 bg-background/95 backdrop-blur-md border-b border-border/80">
              <div className="flex w-full items-center justify-around text-xs sm:text-sm font-bold">
                {/* Tab 1: Dành cho bạn (Smart Hybrid Recommendation) */}
                <button
                  type="button"
                  onClick={() => setActiveFeedTab('for_you')}
                  className={cn(
                    'relative flex-1 py-3.5 px-3 text-center cursor-pointer transition-colors',
                    activeFeedTab === 'for_you'
                      ? 'text-foreground font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span className="flex items-center gap-1.5 justify-center truncate">
                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Dành cho bạn</span>
                  </span>
                  {activeFeedTab === 'for_you' && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-12 rounded-full bg-primary" />
                  )}
                </button>

                {/* Tab 2: Đang theo dõi (Following Timeline) */}
                <button
                  type="button"
                  onClick={() => setActiveFeedTab('following')}
                  className={cn(
                    'relative flex-1 py-3.5 px-3 text-center cursor-pointer transition-colors',
                    activeFeedTab === 'following'
                      ? 'text-foreground font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span className="flex items-center gap-1.5 justify-center truncate">
                    <Users className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Đang theo dõi</span>
                  </span>
                  {activeFeedTab === 'following' && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-12 rounded-full bg-primary" />
                  )}
                </button>

                {/* Tab 3: Hỏi đáp (Academic Q&A / Accepted Solutions) */}
                <button
                  type="button"
                  onClick={() => setActiveFeedTab('qa')}
                  className={cn(
                    'relative flex-1 py-3.5 px-3 text-center cursor-pointer transition-colors',
                    activeFeedTab === 'qa'
                      ? 'text-foreground font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span className="flex items-center gap-1.5 justify-center truncate">
                    <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Hỏi đáp</span>
                  </span>
                  {activeFeedTab === 'qa' && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-12 rounded-full bg-primary" />
                  )}
                </button>
              </div>
            </div>

            {/* Standalone Academic Post Composer (Flat Stream Style) */}
            <div className="px-4 py-3.5 sm:px-5 sm:py-4 border-b border-border/40">
              <AcademicPostComposer />
            </div>

            {/* Continuous X-Style Post Stream */}
            <div className="divide-y divide-border/40">
              {isPostsLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-foreground" />
                  <span className="text-xs">
                    {activeFeedTab === 'following'
                      ? 'Đang tải bài viết từ những người bạn theo dõi...'
                      : activeFeedTab === 'qa'
                        ? 'Đang tải các câu hỏi thảo luận học thuật...'
                        : 'Đang tải bảng tin học thuật được gợi ý...'}
                  </span>
                </div>
              ) : posts.length > 0 ? (
                <>
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}

                  {/* Infinite Scroll Bottom Sentinel */}
                  <div ref={sentinelRef} className="py-6 text-center">
                    {isLoadingMore ? (
                      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin text-foreground" />
                        <span>Đang nạp thêm bài viết phù hợp...</span>
                      </div>
                    ) : !hasMore && posts.length > 5 ? (
                      <div className="flex items-center justify-center gap-1.5 py-4 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span>Bạn đã xem hết các bài viết mới nhất</span>
                      </div>
                    ) : null}
                  </div>
                </>
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
                  <Button
                    size="sm"
                    onClick={() => setCreatePostOpen(true)}
                    className="bg-foreground text-background font-bold rounded-full cursor-pointer"
                  >
                    {activeFeedTab === 'qa' ? 'Đặt câu hỏi ngay' : 'Tạo bài viết mới'}
                  </Button>
                </div>
              )}
            </div>
          </main>

          {/* 3. Right Sidebar (Desktop lg: and above) */}
          <div className="hidden lg:block w-72 xl:w-80 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-4 pl-4 xl:pl-6">
            <RightSidebar />
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav />
      </div>
    </AuthGuard>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <HomeContent />
    </Suspense>
  )
}
