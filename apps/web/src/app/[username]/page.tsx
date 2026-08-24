'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/auth/auth-guard'
import { Header } from '@/components/social/header'
import { Sidebar } from '@/components/social/sidebar'
import { RightSidebar } from '@/components/social/right-sidebar'
import { MobileBottomNav } from '@/components/navigation/mobile-bottom-nav'
import { ProfileHeader } from '@/components/profile/profile-header'
import { ProfileBadgesTab } from '@/components/profile/profile-badges-tab'
import { PostCard } from '@/components/social/post-card'
import { DocumentCard } from '@/components/social/document-card'
import { StudyGroupCard } from '@/components/social/study-group-card'
import { DocumentPreviewModal } from '@/components/viewer/document-preview-modal'
import { useProfile } from '@/hooks/use-profile'
import { useScrollDirection } from '@/hooks/use-scroll-direction'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  FileText,
  BookOpen,
  Users,
  Award,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

type TabType = 'posts' | 'documents' | 'groups' | 'badges'

export default function ProfilePage({
  params
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = use(params)
  const router = useRouter()
  const { profile, isLoading, error } = useProfile(username)
  const { isHeaderVisible } = useScrollDirection(8)

  const [activeTab, setActiveTab] = useState<TabType>('posts')
  const previewDocument = useAppStore((state) => state.previewDocument)
  const setPreviewDocument = useAppStore((state) => state.setPreviewDocument)

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
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
        <div className="mx-auto flex justify-center max-w-7xl px-0 sm:px-4 lg:px-6 min-h-screen">
          {/* 1. Left Sidebar Navigation (Icon-only on md, full wide on xl) */}
          <div className="hidden md:flex shrink-0 w-16 xl:w-64 sticky top-14 h-[calc(100vh-3.5rem)] py-3 flex-col justify-between z-30">
            <Sidebar />
          </div>

          {/* 2. Center Profile Column (Max-w 620px, clean borders, zero horizontal shift) */}
          <main className="flex-1 max-w-[620px] w-full min-w-0 border-x border-border/80 min-h-screen pb-20 md:pb-12">
            {/* Sticky Topbar with Back Button (Smooth Hide on Scroll Down, Show on Scroll Up) */}
            <div
              className={cn(
                'sticky z-30 bg-background/95 backdrop-blur-md border-b border-border/80 px-4 py-3 flex items-center gap-3 transition-all duration-300 ease-in-out',
                isHeaderVisible
                  ? 'top-13 md:top-14 translate-y-0'
                  : '-top-14 md:top-14 -translate-y-full md:translate-y-0'
              )}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full hover:bg-muted cursor-pointer"
                onClick={() => router.push('/home')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <h2 className="text-base font-bold tracking-tight text-foreground truncate leading-none">
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
                <ProfileHeader profile={profile} />

                {/* Sticky Navigation Tabs */}
                <div
                  className={cn(
                    'sticky z-20 bg-background/95 backdrop-blur-md border-b border-border flex items-center transition-all duration-300 ease-in-out',
                    isHeaderVisible
                      ? 'top-[102px] md:top-[109px]'
                      : 'top-0 md:top-[109px]'
                  )}
                >
                  <button
                    onClick={() => setActiveTab('posts')}
                    className={`flex-1 py-3 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                      activeTab === 'posts'
                        ? 'border-primary text-foreground font-bold'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
                    }`}
                  >
                    <FileText className="h-4 w-4" />
                    <span>Bài viết</span>
                    <span className="text-[11px] px-1.5 py-0.2 bg-muted rounded-full ml-0.5">
                      {profile.posts?.length || 0}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab('documents')}
                    className={`flex-1 py-3 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                      activeTab === 'documents'
                        ? 'border-primary text-foreground font-bold'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
                    }`}
                  >
                    <BookOpen className="h-4 w-4" />
                    <span>Tài liệu</span>
                    <span className="text-[11px] px-1.5 py-0.2 bg-muted rounded-full ml-0.5">
                      {profile.documents?.length || 0}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab('groups')}
                    className={`flex-1 py-3 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                      activeTab === 'groups'
                        ? 'border-primary text-foreground font-bold'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    <span>Nhóm PBL</span>
                    <span className="text-[11px] px-1.5 py-0.2 bg-muted rounded-full ml-0.5">
                      {profile.studyGroups?.length || 0}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab('badges')}
                    className={`flex-1 py-3 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                      activeTab === 'badges'
                        ? 'border-primary text-foreground font-bold'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
                    }`}
                  >
                    <Award className="h-4 w-4" />
                    <span>Huy hiệu</span>
                  </button>
                </div>

                {/* Tab 1: Posts (Continuous stream on mobile, card on sm:) */}
                {activeTab === 'posts' && (
                  <div className="divide-y divide-border/60 sm:divide-y-0 sm:space-y-4 sm:p-4">
                    {profile.posts && profile.posts.length > 0 ? (
                      profile.posts.map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          onLikeToggle={() => {}}
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
                  <div className="p-3 sm:p-4">
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

                {/* Tab 3: Study Groups */}
                {activeTab === 'groups' && (
                  <div className="p-3 sm:p-4">
                    {profile.studyGroups && profile.studyGroups.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3">
                        {profile.studyGroups.map((group) => (
                          <StudyGroupCard key={group.id} group={group} />
                        ))}
                      </div>
                    ) : (
                      <div className="py-16 text-center text-muted-foreground">
                        <Users className="h-10 w-10 mx-auto mb-2.5 opacity-30" />
                        <p className="text-sm font-medium">Chưa tham gia nhóm đồ án nào</p>
                        <p className="text-xs mt-1">
                          Sinh viên chưa tạo hoặc tham gia đề tài PBL nào trong học kỳ này.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 4: Badges */}
                {activeTab === 'badges' && (
                  <div className="p-3 sm:p-4">
                    <ProfileBadgesTab profile={profile} />
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

        {/* Mobile Bottom Navigation Bar & FAB */}
        <MobileBottomNav />
      </div>
    </AuthGuard>
  )
}
