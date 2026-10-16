'use client'

import { SlidingTabs } from '@/components/navigation/sliding-tabs'
import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { ProfileHeader } from '@/components/profile/profile-header'
import { PostCard } from '@/components/social/post-card'
import { DocumentCard } from '@/components/social/document-card'
import { useProfile } from '@/hooks/use-profile'
import { useScrollDirection } from '@/hooks/use-scroll-direction'
import { Button } from '@/components/ui/button'
import { ArrowLeft, FileText, BookOpen, HelpCircle, AlertCircle, Ban } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { ProfileSkeleton } from '@/components/skeletons/profile-skeleton'

type TabType = 'posts' | 'documents' | 'questions'

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params)
  const router = useRouter()
  const { profile, isLoading, error, refetch } = useProfile(username)
  const { isHeaderVisible } = useScrollDirection(8)

  const [activeTab, setActiveTab] = useState<TabType>('posts')

  // Filter question posts for Q&A tab
  const questionPosts = profile?.posts?.filter((p) => p.postType === 'qa') || []

  return (
    <>
      {/* Sticky Topbar with Back Button (Natural Scroll on Mobile, Sticky on Desktop) */}
      <div className="sticky top-0 md:top-14 z-30 bg-surface/90 backdrop-blur-md px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted cursor-pointer" onClick={() => router.push('/')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          {isLoading ? (
            <div className="space-y-1.5" aria-hidden>
              <Skeleton className="h-[15px] w-32" />
              <Skeleton className="h-3 w-16" />
            </div>
          ) : (
            <>
              <h2 className="text-[15px] font-semibold tracking-tight text-foreground truncate leading-none">{profile?.displayName || `@${username}`}</h2>
              <p className="text-xs text-muted-foreground mt-1">{profile?.posts?.length || 0} bài viết</p>
            </>
          )}
        </div>
      </div>

      {/* Profile Loading State */}
      {isLoading && <ProfileSkeleton />}

      {/* Profile Error / Not Found State */}
      {!isLoading && error && (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="h-14 w-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">Không tìm thấy người dùng</h3>
          <p className="text-sm text-muted-foreground max-w-md mb-6">Tài khoản @{username} không tồn tại hoặc đã được thay đổi.</p>
          <Button onClick={() => router.push('/')} className="rounded-full cursor-pointer">
            Quay lại Bảng tin
          </Button>
        </div>
      )}

      {/* Profile Content */}
      {!isLoading && profile && (
        <div>
          {/* Profile Header */}
          <div className="mx-2 sm:mx-0 mb-2.5 rounded-xl bg-card overflow-hidden">
            {/* key: đổi trạng thái chặn ⇒ đặt lại số người theo dõi trong header */}
            <ProfileHeader key={profile.blockState} profile={profile} onRefetch={refetch} />
          </div>

          {profile.blockState && profile.blockState !== 'none' ? (
            <BlockedNotice username={profile.username} blockState={profile.blockState} />
          ) : (
            <>
              {/* Sticky Navigation Tabs */}
              <div
                className={cn(
                  'sticky z-20 mb-2.5 bg-surface/90 backdrop-blur-md px-4 sm:px-1 transition-all duration-300 ease-in-out',
                  isHeaderVisible ? 'top-[102px] md:top-[109px]' : 'top-0 md:top-[109px]'
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
                    profile.posts.map((post) => <PostCard key={post.id} post={post} onLikeToggle={() => {}} variant="card" />)
                  ) : (
                    <div className="py-16 text-center text-muted-foreground">
                      <FileText className="h-10 w-10 mx-auto mb-2.5 opacity-30" />
                      <p className="text-sm font-medium">Chưa có bài viết nào</p>
                      <p className="text-xs mt-1">@{profile.username} chưa đăng câu hỏi hoặc chia sẻ nào trên diễn đàn.</p>
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
                        <DocumentCard key={doc.id} document={doc} />
                      ))}
                    </div>
                  ) : (
                    <div className="py-16 text-center text-muted-foreground">
                      <BookOpen className="h-10 w-10 mx-auto mb-2.5 opacity-30" />
                      <p className="text-sm font-medium">Chưa đóng góp tài liệu nào</p>
                      <p className="text-xs mt-1">Kho đề thi và slide bài giảng của @{profile.username} đang trống.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Q&A Questions */}
              {activeTab === 'questions' && (
                <div className="space-y-2.5 px-2 sm:px-0">
                  {questionPosts.length > 0 ? (
                    questionPosts.map((post) => <PostCard key={post.id} post={post} onLikeToggle={() => {}} variant="card" />)
                  ) : (
                    <div className="py-16 text-center text-muted-foreground">
                      <HelpCircle className="h-10 w-10 mx-auto mb-2.5 opacity-30" />
                      <p className="text-sm font-medium">Chưa có câu hỏi thảo luận nào</p>
                      <p className="text-xs mt-1">Sinh viên chưa đặt câu hỏi Q&A nào liên quan đến môn học hoặc bài tập.</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}

// Thay nội dung hồ sơ khi có quan hệ chặn
function BlockedNotice({ username, blockState }: { username: string; blockState: 'blocking' | 'blocked_by' }) {
  return (
    <div className="mx-2 sm:mx-0 rounded-xl bg-card py-14 px-6 text-center">
      <Ban className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
      {blockState === 'blocking' ? (
        <>
          <p className="text-sm font-semibold text-foreground">Bạn đã chặn @{username}</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            Bạn không thấy bài viết của họ và họ không thể nhắn tin hay theo dõi bạn. Bỏ chặn để xem lại.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold text-foreground">Bạn không xem được nội dung này</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">@{username} đã hạn chế tương tác với bạn.</p>
        </>
      )}
    </div>
  )
}
