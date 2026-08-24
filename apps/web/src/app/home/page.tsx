'use client'

import React, { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/social/header'
import { Sidebar } from '@/components/social/sidebar'
import { RightSidebar } from '@/components/social/right-sidebar'
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

function HomeContent() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')

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
        {/* Global Navigation Header */}
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

        {/* Main 3-Column Layout (X Social Style) */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            
            {/* 1. Left Sidebar Navigation (3 cols) */}
            <div className="hidden md:block md:col-span-3 sticky top-20">
              <Sidebar />
            </div>

            {/* 2. Center Feed Column (6 cols) */}
            <main className="md:col-span-9 lg:col-span-6 space-y-4">
              
              {/* X-style Feed Header with Sticky Tab Bar */}
              <div className="sticky top-16 z-30 -mx-4 sm:mx-0 px-4 sm:px-0 bg-background/95 backdrop-blur-md border-b border-border">
                <div className="flex w-full items-center justify-around text-xs font-bold">
                  <button
                    onClick={() => setActiveFeedTab('for_you')}
                    className={`relative py-3.5 px-4 text-center cursor-pointer transition-colors ${
                      activeFeedTab === 'for_you'
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 justify-center">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Dành cho bạn</span>
                    </span>
                    {activeFeedTab === 'for_you' && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-12 rounded-full bg-primary" />
                    )}
                  </button>

                  <button
                    onClick={() => setActiveFeedTab('courses')}
                    className={`relative py-3.5 px-4 text-center cursor-pointer transition-colors ${
                      activeFeedTab === 'courses'
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span>Môn học & Đề thi</span>
                    {activeFeedTab === 'courses' && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-12 rounded-full bg-primary" />
                    )}
                  </button>

                  <button
                    onClick={() => setActiveFeedTab('documents')}
                    className={`relative py-3.5 px-4 text-center cursor-pointer transition-colors ${
                      activeFeedTab === 'documents'
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span>Kho tài liệu</span>
                    {activeFeedTab === 'documents' && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-12 rounded-full bg-primary" />
                    )}
                  </button>

                  <button
                    onClick={() => setActiveFeedTab('bookmarks')}
                    className={`relative py-3.5 px-4 text-center cursor-pointer transition-colors ${
                      activeFeedTab === 'bookmarks'
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 justify-center">
                      <Bookmark className="h-3.5 w-3.5" />
                      <span>Đã lưu</span>
                    </span>
                    {activeFeedTab === 'bookmarks' && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-12 rounded-full bg-primary" />
                    )}
                  </button>
                </div>
              </div>

              {/* Standalone Academic Post Composer (hidden when viewing bookmarks or documents) */}
              {activeFeedTab !== 'bookmarks' && activeFeedTab !== 'documents' && (
                <AcademicPostComposer />
              )}

              {/* Feed Content Rendering */}
              {(activeFeedTab === 'for_you' || activeFeedTab === 'courses' || activeFeedTab === 'bookmarks') && (
                <div className="space-y-4">
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
                      <div ref={sentinelRef} className="py-4 text-center">
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
                    <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
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
                          className="bg-foreground text-background font-bold rounded-full"
                        >
                          Tạo bài viết mới
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeFeedTab === 'documents' && (
                <div className="space-y-3">
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

            {/* 3. Right Sidebar (3 cols) */}
            <div className="hidden lg:block lg:col-span-3 sticky top-20">
              <RightSidebar />
            </div>
          </div>
        </div>
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

