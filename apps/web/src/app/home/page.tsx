'use client'

import React, { useState } from 'react'
import { Header } from '@/components/social/header'
import { Sidebar } from '@/components/social/sidebar'
import { RightSidebar } from '@/components/social/right-sidebar'
import { PostCard } from '@/components/social/post-card'
import { DocumentCard } from '@/components/social/document-card'
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
  Sparkles,
  Flame,
  FileText,
  GraduationCap,
  Users,
  Building2,
  Bookmark,
  Loader2,
  MessageSquarePlus,
  Search,
  Filter
} from 'lucide-react'

export default function HomePage() {
  const [activeFeedTab, setActiveFeedTab] = useState<'for_you' | 'courses' | 'documents'>('for_you')
  const { posts, isLoading: isPostsLoading, refetch: refetchPosts } = usePosts()
  const { documents, isLoading: isDocsLoading } = useDocuments()
  
  const user = useAppStore((state) => state.user)
  const isCreatePostOpen = useAppStore((state) => state.isCreatePostOpen)
  const setCreatePostOpen = useAppStore((state) => state.setCreatePostOpen)
  const isCreateDocumentOpen = useAppStore((state) => state.isCreateDocumentOpen)
  const setCreateDocumentOpen = useAppStore((state) => state.setCreateDocumentOpen)
  const isCreateGroupOpen = useAppStore((state) => state.isCreateGroupOpen)
  const setCreateGroupOpen = useAppStore((state) => state.setCreateGroupOpen)
  const previewDocument = useAppStore((state) => state.previewDocument)
  const setPreviewDocument = useAppStore((state) => state.setPreviewDocument)

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
                    <span>Dành cho bạn</span>
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
                </div>
              </div>

              {/* X-style Quick Post Composer Box */}
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-sm">
                    {(user?.displayName || (user as any)?.display_name || user?.username || 'PU')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="flex-1 space-y-3">
                    <button
                      onClick={() => setCreatePostOpen(true)}
                      className="w-full text-left rounded-xl bg-muted/50 hover:bg-muted px-4 py-2.5 text-xs text-muted-foreground transition-colors cursor-pointer"
                    >
                      Chia sẻ câu hỏi học thuật, bài giảng hoặc tài liệu đề thi...
                    </button>
                    <div className="flex items-center justify-between pt-1 border-t border-border/40">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setCreateDocumentOpen(true)}
                          className="h-8 gap-1 text-[11px] text-muted-foreground hover:text-primary"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>Chia sẻ tài liệu</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setCreateGroupOpen(true)}
                          className="h-8 gap-1 text-[11px] text-muted-foreground hover:text-primary"
                        >
                          <Users className="h-3.5 w-3.5" />
                          <span>Tuyển nhóm PBL</span>
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setCreatePostOpen(true)}
                        className="h-8 rounded-full px-4 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        Đăng bài
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feed Content Rendering */}
              {activeFeedTab === 'for_you' && (
                <div className="space-y-4">
                  {isPostsLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="text-xs">Đang tải bảng tin học thuật...</span>
                    </div>
                  ) : posts.length > 0 ? (
                    posts.map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
                      <MessageSquarePlus className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                      <h3 className="text-sm font-bold text-foreground">Chưa có bài viết nào</h3>
                      <p className="text-xs text-muted-foreground mt-1 mb-4">
                        Hãy là người đầu tiên đặt câu hỏi hoặc chia sẻ tài liệu học phần!
                      </p>
                      <Button
                        size="sm"
                        onClick={() => setCreatePostOpen(true)}
                        className="bg-primary text-primary-foreground"
                      >
                        Tạo bài viết mới
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {activeFeedTab === 'courses' && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-muted/40 p-3 text-xs border border-border flex items-center justify-between">
                    <span className="font-semibold text-foreground">Học phần trọng tâm kỳ này</span>
                    <span className="text-[11px] text-muted-foreground">Học kỳ 2 (2025-2026)</span>
                  </div>
                  {posts
                    .filter((p) => p.tags && p.tags.some((t) => t.includes('IT') || t.includes('MATH') || t.includes('PHY')))
                    .map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))}
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
                      className="h-7 text-[11px] gap-1"
                    >
                      <FileText className="h-3 w-3" />
                      <span>Thêm tài liệu</span>
                    </Button>
                  </div>
                  {isDocsLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
