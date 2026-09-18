'use client'

import React, { use, useRef, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/auth/auth-guard'
import { Header } from '@/components/social/header'
import { Sidebar } from '@/components/social/sidebar'
import { MobileBottomNav } from '@/components/navigation/mobile-bottom-nav'
import { AcademicPostComposer } from '@/components/social/composer/academic-post-composer'
import { PostCard } from '@/components/social/post-card'
import { DocumentPreviewModal } from '@/components/viewer/document-preview-modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCommunity } from '@/hooks/use-community'
import { useAppStore } from '@/store'
import {
  Users,
  Flame,
  Sparkles,
  Clock,
  Award,
  ShieldCheck,
  BookOpen,
  ArrowLeft,
  Loader2,
  Check,
  UserPlus,
  AlertCircle,
  Share2,
  Compass
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export default function CommunityDetailPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'hot' | 'new' | 'top' | 'rules'>('hot')

  const {
    community,
    posts,
    sort,
    setSort,
    isLoading,
    isLoadingMore,
    hasMore,
    fetchMore,
    toggleJoin,
    isJoining,
    addPost
  } = useCommunity(slug, 'hot')

  const previewDocument = useAppStore((state) => state.previewDocument)
  const setPreviewDocument = useAppStore((state) => state.setPreviewDocument)

  // Infinite Scroll Sentinel
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          fetchMore()
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    )

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current)
    }

    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, isLoading, fetchMore])

  const handleTabChange = (tab: 'hot' | 'new' | 'top' | 'rules') => {
    setActiveTab(tab)
    if (tab !== 'rules') {
      setSort(tab)
    }
  }

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href)
      toast.success('Đã sao chép liên kết cộng đồng')
    }
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
        {/* Unified Top Header */}
        <Header />

        {/* In-App Document Preview Modal */}
        <DocumentPreviewModal
          document={previewDocument}
          open={!!previewDocument}
          onOpenChange={(open) => {
            if (!open) setPreviewDocument(null)
          }}
        />

        {/* 3-Column Layout */}
        <div className="mx-auto flex justify-center max-w-7xl px-0 sm:px-4 lg:px-6 min-h-screen">
          {/* 1. Left Sidebar Navigation */}
          <div className="hidden md:flex shrink-0 w-16 xl:w-64 sticky top-14 h-[calc(100vh-3.5rem)] py-3 flex-col justify-between z-30">
            <Sidebar />
          </div>

          {/* 2. Center Feed Column */}
          <main className="flex-1 max-w-[700px] xl:max-w-[720px] w-full min-w-0 border-x border-border/80 min-h-screen pb-20 md:pb-12">
            {/* Top Navigation Bar */}
            <div className="sticky top-0 md:top-14 z-30 bg-background/95 backdrop-blur-md border-b border-border/80 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full hover:bg-muted cursor-pointer shrink-0"
                  onClick={() => router.back()}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                  <h1 className="text-base font-bold tracking-tight text-foreground truncate leading-none">
                    {community?.name || `c/${slug}`}
                  </h1>
                  <p className="text-xs text-muted-foreground mt-1">
                    {community?.membersCount || 0} thành viên · {community?.postsCount || 0} bài viết
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-full text-xs font-semibold"
                onClick={handleShare}
              >
                <Share2 className="h-3.5 w-3.5" />
                Chia sẻ
              </Button>
            </div>

            {/* Community Hero Banner & Header */}
            {isLoading && !community ? (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">Đang tải cộng đồng c/{slug}...</p>
              </div>
            ) : community ? (
              <div>
                {/* Banner Image */}
                <div className="relative h-40 sm:h-52 w-full bg-muted overflow-hidden">
                  {community.bannerUrl ? (
                    <img
                      src={community.bannerUrl}
                      alt={community.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-r from-primary/30 via-accent/30 to-background" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
                </div>

                {/* Community Info Bar */}
                <div className="px-4 sm:px-6 pb-4 border-b border-border/80">
                  <div className="flex items-end justify-between -mt-12 sm:-mt-14 mb-3">
                    <div className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-2xl overflow-hidden border-4 border-background bg-card shadow-xl shrink-0">
                      {community.avatarUrl ? (
                        <img
                          src={community.avatarUrl}
                          alt={community.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-2xl">
                          {community.slug.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <Button
                      variant={community.isMember ? 'outline' : 'default'}
                      size="sm"
                      disabled={isJoining}
                      onClick={toggleJoin}
                      className={cn(
                        'h-9 rounded-full px-5 text-sm font-semibold transition-all duration-200',
                        community.isMember
                          ? 'border-border text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30'
                          : 'bg-primary text-primary-foreground shadow-md hover:bg-primary/90'
                      )}
                    >
                      {isJoining ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : community.isMember ? (
                        <span className="flex items-center gap-1.5">
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                          Đã tham gia
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <UserPlus className="h-3.5 w-3.5" />
                          Gia nhập
                        </span>
                      )}
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                        {community.name}
                      </h2>
                      <Badge variant="secondary" className="text-xs font-mono font-bold bg-primary/10 text-primary border-primary/20">
                        c/{community.slug}
                      </Badge>
                      <Badge variant="outline" className="text-xs capitalize font-medium">
                        {community.communityType === 'campus' && '🏛️ Đại sảnh'}
                        {community.communityType === 'faculty' && '🎓 Khoa / Viện'}
                        {community.communityType === 'academic' && '📚 Học thuật'}
                        {community.communityType === 'life' && '🏡 Đời sống'}
                        {community.communityType === 'club' && '⚽ Câu lạc bộ'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {community.description}
                    </p>
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex items-center gap-1 mt-5 border-t border-border/50 pt-2 overflow-x-auto no-scrollbar">
                    <button
                      onClick={() => handleTabChange('hot')}
                      className={cn(
                        'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer shrink-0',
                        activeTab === 'hot'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      <Flame className="h-3.5 w-3.5" />
                      Sôi nổi (Hot)
                    </button>
                    <button
                      onClick={() => handleTabChange('new')}
                      className={cn(
                        'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer shrink-0',
                        activeTab === 'new'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      Mới nhất (New)
                    </button>
                    <button
                      onClick={() => handleTabChange('top')}
                      className={cn(
                        'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer shrink-0',
                        activeTab === 'top'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      <Award className="h-3.5 w-3.5" />
                      Hàng đầu (Top)
                    </button>
                    <button
                      onClick={() => handleTabChange('rules')}
                      className={cn(
                        'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer shrink-0',
                        activeTab === 'rules'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Nội quy ({community.rules?.length || 0})
                    </button>
                  </div>
                </div>

                {/* Tab Content */}
                {activeTab === 'rules' ? (
                  <div className="p-4 sm:p-6 space-y-4">
                    <div className="flex items-center gap-2 text-primary font-bold text-base">
                      <ShieldCheck className="h-5 w-5" />
                      Quy tắc & Chuẩn mực cộng đồng c/{community.slug}
                    </div>
                    {community.rules && community.rules.length > 0 ? (
                      <div className="space-y-3">
                        {community.rules.map((rule, idx) => (
                          <div
                            key={idx}
                            className="p-4 rounded-xl bg-card border border-border/80 shadow-xs space-y-1"
                          >
                            <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                              <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-mono font-bold">
                                {idx + 1}
                              </span>
                              {rule.title}
                            </h4>
                            <p className="text-xs text-muted-foreground pl-7 leading-relaxed">
                              {rule.desc}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Cộng đồng chưa thiết lập quy tắc riêng. Vui lòng tuân thủ quy tắc văn hóa ứng xử chung của Trường Đại học Phenikaa.
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    {/* Post Composer scoped to this community */}
                    <div className="px-4 py-3.5 sm:px-5 sm:py-4 border-b border-border/40">
                      <AcademicPostComposer
                        onPostCreated={(post) => addPost(post)}
                        defaultCommunityId={community.id}
                        defaultCommunitySlug={community.slug}
                      />
                    </div>

                    {/* Posts Stream */}
                    {posts.length === 0 ? (
                      <div className="py-16 text-center text-muted-foreground space-y-2">
                        <BookOpen className="h-10 w-10 mx-auto opacity-30 text-primary" />
                        <p className="text-sm font-medium">Chưa có bài viết nào trong cộng đồng này.</p>
                        <p className="text-xs">Hãy là người đầu tiên chia sẻ bài viết tại c/{community.slug}!</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/40">
                        {posts.map((post) => (
                          <PostCard key={post.id} post={post} />
                        ))}
                      </div>
                    )}

                    {/* Sentinel for Infinite Scroll */}
                    <div ref={sentinelRef} className="py-6 flex items-center justify-center text-muted-foreground">
                      {isLoadingMore && (
                        <div className="flex items-center gap-2 text-xs">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span>Đang nạp thêm bài viết c/{community.slug}...</span>
                        </div>
                      )}
                      {!hasMore && posts.length > 0 && (
                        <span className="text-xs opacity-60">Bạn đã xem hết bài viết trong cộng đồng</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-20 text-center text-muted-foreground space-y-3">
                <AlertCircle className="h-10 w-10 mx-auto text-destructive opacity-50" />
                <p className="text-base font-semibold">Không tìm thấy cộng đồng này</p>
                <Button variant="outline" size="sm" onClick={() => router.push('/communities')}>
                  Xem danh sách cộng đồng
                </Button>
              </div>
            )}
          </main>

          {/* 3. Right Sidebar: Community Information & Rules */}
          <aside className="hidden lg:block shrink-0 w-80 sticky top-14 h-[calc(100vh-3.5rem)] py-3 pl-6 space-y-4 overflow-y-auto no-scrollbar">
            {community && (
              <Card className="border border-border/80 bg-card rounded-2xl shadow-xs overflow-hidden">
                <CardHeader className="p-4 pb-2 bg-muted/40 border-b border-border/60">
                  <CardTitle className="text-xs uppercase font-extrabold text-muted-foreground tracking-wider flex items-center gap-2">
                    <Compass className="h-3.5 w-3.5 text-primary" />
                    Thông tin diễn đàn
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3 text-xs">
                  <p className="text-muted-foreground leading-relaxed">
                    {community.description}
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-center">
                    <div className="p-2 rounded-xl bg-muted/40">
                      <div className="font-extrabold text-base text-foreground">
                        {community.membersCount}
                      </div>
                      <div className="text-[11px] text-muted-foreground">Thành viên</div>
                    </div>
                    <div className="p-2 rounded-xl bg-muted/40">
                      <div className="font-extrabold text-base text-foreground">
                        {community.postsCount}
                      </div>
                      <div className="text-[11px] text-muted-foreground">Bài thảo luận</div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/60 space-y-1.5 text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Định danh:</span>
                      <span className="font-mono font-bold text-foreground">c/{community.slug}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Trực thuộc:</span>
                      <span className="font-semibold text-foreground">Đại học Phenikaa</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Link to Explore other communities */}
            <Card className="border border-border/80 bg-card rounded-2xl shadow-xs p-4 space-y-3">
              <h4 className="font-bold text-xs text-foreground flex items-center gap-2">
                <Compass className="h-4 w-4 text-primary" />
                Khám phá các cộng đồng khác
              </h4>
              <p className="text-xs text-muted-foreground">
                Tham gia diễn đàn các Khoa, nhóm đồ án tốt nghiệp và chợ sinh viên.
              </p>
              <Link href="/communities" className="block">
                <Button variant="outline" size="sm" className="w-full text-xs font-semibold rounded-full">
                  Xem tất cả cộng đồng →
                </Button>
              </Link>
            </Card>
          </aside>
        </div>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav />
      </div>
    </AuthGuard>
  )
}
