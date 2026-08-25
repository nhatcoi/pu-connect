'use client'

import React, { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/social/header'
import { Sidebar } from '@/components/social/sidebar'
import { RightSidebar } from '@/components/social/right-sidebar'
import { MobileBottomNav } from '@/components/navigation/mobile-bottom-nav'
import { PostCard } from '@/components/social/post-card'
import { DocumentCard } from '@/components/social/document-card'
import { AcademicPostComposer } from '@/components/social/composer/academic-post-composer'
import { CreatePostDialog } from '@/components/social/create-post-dialog'
import { CreateDocumentDialog } from '@/components/social/create-document-dialog'
import { CreateGroupDialog } from '@/components/social/create-group-dialog'
import { DocumentPreviewModal } from '@/components/viewer/document-preview-modal'
import { AuthGuard } from '@/components/auth/auth-guard'
import { usePosts } from '@/hooks/use-posts'
import { useDocuments } from '@/hooks/use-documents'
import { useScrollDirection } from '@/hooks/use-scroll-direction'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import {
  FileText,
  Loader2,
  MessageSquarePlus,
  CheckCircle2,
  Sparkles,
  Bookmark
} from 'lucide-react'
import { cn } from '@/lib/utils'

function HomeContent() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const { isHeaderVisible } = useScrollDirection(8)

  const [activeFeedTab, setActiveFeedTab] = useState<'for_you' | 'courses' | 'documents' | 'bookmarks'>('for_you')
  
  useEffect(() => {
    if (tabParam === 'bookmarks') {
      setActiveFeedTab('bookmarks')
    } else if (tabParam === 'courses') {
      setActiveFeedTab('courses')
    } else if (tabParam === 'documents') {
      setActiveFeedTab('documents')
    } else if (!tabParam) {
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
    feedType: activeFeedTab === 'documents' ? 'for_you' : activeFeedTab
  })

  const { documents, isLoading: isDocsLoading } = useDocuments()
  
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
    if (activeFeedTab === 'documents') return

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
  }, [hasMore, isLoadingMore, isPostsLoading, fetchMore, activeFeedTab])

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
        {/* Global Navigation Header with Auto-hide on Mobile Scroll */}
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

        {/* Main 3-Column Layout (X Twitter Architecture) */}
        <div className="mx-auto flex justify-center max-w-7xl px-0 sm:px-4 lg:px-6 min-h-screen">
          
          {/* 1. Left Sidebar Navigation (Icon-only on md, full on xl) */}
          <div className="hidden md:flex shrink-0 w-16 xl:w-64 sticky top-14 h-[calc(100vh-3.5rem)] py-3 flex-col justify-between z-30">
            <Sidebar />
          </div>

          {/* 2. Center Feed Column (Wider for academic readability, crisp dividing borders) */}
          <main className="flex-1 max-w-[700px] xl:max-w-[720px] w-full min-w-0 border-x border-border/80 min-h-screen pb-20 md:pb-12">
            
            {/* X-style Feed Header with Sticky Tab Bar (Smooth Hide on Scroll Down, Show on Scroll Up) */}
            <div
              className={cn(
                'sticky z-30 bg-background/95 backdrop-blur-md border-b border-border/80 transition-transform duration-300 ease-in-out',
                isHeaderVisible
                  ? 'top-13 md:top-14 translate-y-0'
                  : '-top-14 md:top-14 -translate-y-full md:translate-y-0'
              )}
            >
              <div className="flex w-full items-center justify-around text-xs sm:text-sm font-bold">
                <button
                  onClick={() => setActiveFeedTab('for_you')}
                  className={`relative flex-1 py-3.5 px-2 sm:px-4 text-center cursor-pointer transition-colors ${
                    activeFeedTab === 'for_you'
                      ? 'text-foreground font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="flex items-center gap-1.5 justify-center truncate">
                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Dành cho bạn</span>
                  </span>
                  {activeFeedTab === 'for_you' && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-12 rounded-full bg-primary" />
                  )}
                </button>

                <button
                  onClick={() => setActiveFeedTab('courses')}
                  className={`relative flex-1 py-3.5 px-2 sm:px-4 text-center cursor-pointer transition-colors ${
                    activeFeedTab === 'courses'
                      ? 'text-foreground font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="truncate block">Môn học & Đề thi</span>
                  {activeFeedTab === 'courses' && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-12 rounded-full bg-primary" />
                  )}
                </button>

                <button
                  onClick={() => setActiveFeedTab('documents')}
                  className={`relative flex-1 py-3.5 px-2 sm:px-4 text-center cursor-pointer transition-colors ${
                    activeFeedTab === 'documents'
                      ? 'text-foreground font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="truncate block">Kho tài liệu</span>
                  {activeFeedTab === 'documents' && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-12 rounded-full bg-primary" />
                  )}
                </button>

                <button
                  onClick={() => setActiveFeedTab('bookmarks')}
                  className={`relative flex-1 py-3.5 px-2 sm:px-4 text-center cursor-pointer transition-colors ${
                    activeFeedTab === 'bookmarks'
                      ? 'text-foreground font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="flex items-center gap-1.5 justify-center truncate">
                    <Bookmark className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Đã lưu</span>
                  </span>
                  {activeFeedTab === 'bookmarks' && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-12 rounded-full bg-primary" />
                  )}
                </button>
              </div>
            </div>

            {/* Standalone Academic Post Composer (hidden when viewing bookmarks or documents) */}
            {activeFeedTab !== 'bookmarks' && activeFeedTab !== 'documents' && (
              <div className="p-3 sm:p-4 border-b border-border/60 sm:border-b-0">
                <AcademicPostComposer />
              </div>
            )}

            {/* Continuous X-style Post Stream */}
            {(activeFeedTab === 'for_you' || activeFeedTab === 'courses' || activeFeedTab === 'bookmarks') && (
              <div className="divide-y divide-border/60 sm:divide-y-0 sm:space-y-4 sm:p-4">
                {isPostsLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin text-foreground" />
                    <span className="text-xs">
                      {activeFeedTab === 'bookmarks' ? 'Đang tải bài viết đã lưu...' : 'Đang tải bảng tin học thuật được gợi ý...'}
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
                      {activeFeedTab === 'bookmarks' ? 'Chưa có bài viết nào được lưu' : 'Chưa có bài viết nào'}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">
                      {activeFeedTab === 'bookmarks'
                        ? 'Bạn có thể bấm biểu tượng Lưu ở bất kỳ bài viết nào trên Bảng tin để lưu lại xem sau.'
                        : 'Hãy là người đầu tiên đặt câu hỏi hoặc chia sẻ tài liệu học phần!'}
                    </p>
                    {activeFeedTab !== 'bookmarks' && (
                      <Button
                        size="sm"
                        onClick={() => setCreatePostOpen(true)}
                        className="bg-foreground text-background font-bold rounded-full cursor-pointer"
                      >
                        Tạo bài viết mới
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeFeedTab === 'documents' && (
              <div className="p-3 sm:p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-foreground">Kho Tài Liệu & Đề Thi Mới Nhất</h2>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCreateDocumentOpen(true)}
                    className="h-7 text-[11px] gap-1 rounded-full cursor-pointer"
                  >
                    <FileText className="h-3 w-3" />
                    <span>Thêm tài liệu</span>
                  </Button>
                </div>
                {isDocsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-foreground" />
                  </div>
                ) : documents.length > 0 ? (
                  documents.map((doc) => <DocumentCard key={doc.id} document={doc} />)
                ) : (
                  <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                    Chưa có tài liệu nào được tải lên.
                  </div>
                )}
              </div>
            )}
          </main>

          {/* 3. Right Sidebar (Desktop lg: and above) */}
          <div className="hidden lg:block w-72 xl:w-80 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-4 pl-4 xl:pl-6">
            <RightSidebar />
          </div>
        </div>

        {/* Mobile Bottom Navigation & Floating Action Button (FAB) */}
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
