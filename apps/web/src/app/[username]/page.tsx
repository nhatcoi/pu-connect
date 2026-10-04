'use client'

import { SlidingTabs } from '@/components/navigation/sliding-tabs'
import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/auth/auth-guard'
import { Header } from '@/components/social/header'
import { Sidebar } from '@/components/social/sidebar'
import { RightSidebar } from '@/components/social/right-sidebar'
import { MobileBottomNav } from '@/components/navigation/mobile-bottom-nav'
import { ProfileHeader } from '@/components/profile/profile-header'
import { PostCard } from '@/components/social/post-card'
import { DocumentCard } from '@/components/social/document-card'
import { DocumentPreviewModal } from '@/components/viewer/document-preview-modal'
import { useProfile } from '@/hooks/use-profile'
import { useScrollDirection } from '@/hooks/use-scroll-direction'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  FileText,
  BookOpen,
  HelpCircle,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

type TabType = 'posts' | 'documents' | 'questions'

export default function ProfilePage({
  params
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = use(params)
  const router = useRouter()
  const { profile, isLoading, error, refetch } = useProfile(username)
  const { isHeaderVisible } = useScrollDirection(8)

  const [activeTab, setActiveTab] = useState<TabType>('posts')
  const previewDocument = useAppStore((state) => state.previewDocument)
  const setPreviewDocument = useAppStore((state) => state.setPreviewDocument)

  // Filter question posts for Q&A tab
  const questionPosts = profile?.posts?.filter((p) => p.postType === 'qa') || []

  return (
    <AuthGuard>
      <div className="min-h-screen bg-surface text-foreground selection:bg-primary selection:text-primary-foreground">
        {/* Global Navigation Header */}
        <Header />

        {/* In-App Document Preview Modal */}
        <DocumentPreviewModal
          document={previewDocument}
          open={!!previewDocument}
          onOpenChange={(open) => {
            if (!open) setPreviewDocument(null)
          }}
        />

        {/* Main 3-Column Layout (X Twitter Style) */}
        <div className="mx-auto flex justify-center gap-6 max-w-7xl px-0 sm:px-4 lg:px-6 min-h-screen">
          {/* 1. Left Sidebar Navigation (Icon-only on md, full wide on xl) */}
          <div className="hidden md:flex shrink-0 w-14 xl:w-56 sticky top-14 h-[calc(100vh-3.5rem)] py-3 flex-col justify-between z-30">
            <Sidebar />
          </div>

          {/* 2. Center Profile Column (Wider for academic content, clean borders, zero horizontal shift) */}
          <main className="flex-1 max-w-[640px] w-full min-w-0 min-h-screen pb-20 md:pb-12">
            {/* Sticky Topbar with Back Button (Natural Scroll on Mobile, Sticky on Desktop) */}
            <div className="sticky top-0 md:top-14 z-30 bg-surface/90 backdrop-blur-md px-4 py-3 flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full hover:bg-muted cursor-pointer"
                onClick={() => router.push('/home')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold tracking-tight text-foreground truncate leading-none">
                  {isLoading
                    ? 'Đang tải...'
                    : profile?.displayName || `@${username}`}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {profile?.posts?.length || 0} bài viết
                </p>
              </div>
            </div>

            {/* Profile Loading State */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">Đang tải hồ sơ @{username}...</p>
              </div>
            )}

            {/* Profile Error / Not Found State */}
            {!isLoading && error && (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <div className="h-14 w-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
                  <AlertCircle className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">
                  Không tìm thấy người dùng
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mb-6">
                  Tài khoản @{username} không tồn tại hoặc đã được thay đổi.
                </p>
                <Button onClick={() => router.push('/home')} className="rounded-full cursor-pointer">
                  Quay lại Bảng tin
                </Button>
              </div>
            )}

            {/* Profile Content */}
            {!isLoading && profile && (
              <div>
                {/* Profile Header */}
                <div className="mx-2 sm:mx-0 mb-2.5 rounded-xl bg-card overflow-hidden">
                  <ProfileHeader profile={profile} onRefetch={refetch} />
                </div>

                {/* Sticky Navigation Tabs */}
                <div
                  className={cn(
                    'sticky z-20 mb-2.5 bg-surface/90 backdrop-blur-md px-4 sm:px-1 transition-all duration-300 ease-in-out',
                    isHeaderVisible
                      ? 'top-[102px] md:top-[109px]'
                      : 'top-0 md:top-[109px]'
                  )}
                >
                  <SlidingTabs
                    value={activeTab}
                    onChange={setActiveTab}
                    items={[
                      { id: 'posts', label: 'Bài viết', badge: profile.posts?.length || 0 },
                      { id: 'documents', label: 'Tài liệu', badge: profile.documents?.length || 0 },
                      { id: 'questions', label: 'Hỏi đáp Q&A', badge: questionPosts.length }
                    ]}
                  />
                </div>

                {/* Tab 1: Posts (Continuous stream on mobile, card on sm:) */}
                {activeTab === 'posts' && (
                  <div className="space-y-2.5 px-2 sm:px-0">
                    {profile.posts && profile.posts.length > 0 ? (
                      profile.posts.map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          onLikeToggle={() => {}}
                          variant="card"
                        />
                      ))
                    ) : (
                      <div className="py-16 text-center text-muted-foreground">
                        <FileText className="h-10 w-10 mx-auto mb-2.5 opacity-30" />
                        <p className="text-sm font-medium">Chưa có bài viết nào</p>
                        <p className="text-xs mt-1">
                          @{profile.username} chưa đăng câu hỏi hoặc chia sẻ nào trên diễn đàn.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Documents */}
                {activeTab === 'documents' && (
                  <div className="px-2 sm:px-0">
                    {profile.documents && profile.documents.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3">
                        {profile.documents.map((doc) => (
                          <DocumentCard
                            key={doc.id}
                            document={doc}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="py-16 text-center text-muted-foreground">
                        <BookOpen className="h-10 w-10 mx-auto mb-2.5 opacity-30" />
                        <p className="text-sm font-medium">Chưa đóng góp tài liệu nào</p>
                        <p className="text-xs mt-1">
                          Kho đề thi và slide bài giảng của @{profile.username} đang trống.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: Q&A Questions */}
                {activeTab === 'questions' && (
                  <div className="space-y-2.5 px-2 sm:px-0">
                    {questionPosts.length > 0 ? (
                      questionPosts.map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          onLikeToggle={() => {}}
                          variant="card"
                        />
                      ))
                    ) : (
                      <div className="py-16 text-center text-muted-foreground">
                        <HelpCircle className="h-10 w-10 mx-auto mb-2.5 opacity-30" />
                        <p className="text-sm font-medium">Chưa có câu hỏi thảo luận nào</p>
                        <p className="text-xs mt-1">
                          Sinh viên chưa đặt câu hỏi Q&A nào liên quan đến môn học hoặc bài tập.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </main>

          {/* 3. Right Sidebar (Desktop lg: and above) */}
          <div className="hidden lg:block w-64 xl:w-72 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-4">
            <RightSidebar />
          </div>
        </div>

        {/* Mobile Bottom Navigation Bar & FAB */}
        <MobileBottomNav />
      </div>
    </AuthGuard>
  )
}
