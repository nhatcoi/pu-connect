'use client'

import React, { use, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, BookOpen, CheckCircle2, FileText, HelpCircle, Loader2, MessagesSquare, Plus, Share2, Star, Users } from 'lucide-react'
import { toast } from 'sonner'
import { AcademicPostComposer } from '@/components/social/composer/academic-post-composer'
import { PostCard } from '@/components/social/post-card'
import { VirtualPostList } from '@/components/social/virtual-post-list'
import { DocumentsBrowse } from '@/components/documents/documents-browse'
import { StudyGroupCard } from '@/components/social/study-group-card'
import { SlidingTabs } from '@/components/navigation/sliding-tabs'
import { PageAside } from '@/components/layout/page-aside'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useCourse } from '@/hooks/use-course'
import { useAppStore } from '@/store'
import { CardListSkeleton, CourseHeaderSkeleton } from '@/components/skeletons/catalog-skeleton'
import { FeedSkeleton, PostListSkeleton } from '@/components/skeletons/feed-skeleton'
import { LoadingRegion } from '@/components/ui/skeleton'

type Tab = 'posts' | 'documents' | 'groups'

// Trang học phần: thảo luận & hỏi đáp, tài liệu/đề thi, nhóm học theo mã môn
export default function CoursePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const courseCode = decodeURIComponent(code).toUpperCase()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('posts')
  const setCreateGroupOpen = useAppStore((s) => s.setCreateGroupOpen)
  const c = useCourse(courseCode)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const { fetchMorePosts } = c
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || tab !== 'posts') return
    const observer = new IntersectionObserver((e) => e[0].isIntersecting && fetchMorePosts(), { rootMargin: '200px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [fetchMorePosts, tab])

  const handleShare = () => {
    void navigator.clipboard.writeText(window.location.href)
    toast.success('Đã sao chép liên kết học phần')
  }

  if (c.notFound) {
    return (
      <div className="py-24 text-center space-y-3 text-muted-foreground">
        <BookOpen className="h-10 w-10 mx-auto opacity-30 text-primary" />
        <p className="text-sm font-medium">Không tìm thấy học phần {courseCode}</p>
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => router.push('/courses')}>
          Xem danh mục môn học
        </Button>
      </div>
    )
  }

  const overview = c.overview
  const course = overview?.course

  return (
    <>
      <div className="sticky top-0 md:top-14 z-30 bg-surface/90 backdrop-blur-md px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold tracking-tight truncate leading-none">{course ? `${course.code} · ${course.name}` : courseCode}</h1>
            <p className="text-xs text-muted-foreground mt-1">{course ? `${course.credits} tín chỉ · ${course.departmentName}` : 'Học phần'}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full text-xs font-semibold" onClick={handleShare}>
          <Share2 className="h-3.5 w-3.5" />
          Chia sẻ
        </Button>
      </div>

      {c.isLoading || !overview || !course ? (
        <LoadingRegion label={`Đang tải học phần ${courseCode}`}>
          <CourseHeaderSkeleton />
          <PostListSkeleton className="px-2 sm:px-0" />
        </LoadingRegion>
      ) : (
        <>
          <div className="mx-2 sm:mx-0 mb-2.5 rounded-xl bg-card p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5 min-w-0">
                <span className="rounded-md bg-primary/10 px-2 py-0.5 font-bold text-xs text-primary font-mono">{course.code}</span>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight">{course.name}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{course.description || 'Chưa có mô tả cho học phần này.'}</p>
              </div>
              <div className="flex items-center gap-1 text-xs font-semibold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded shrink-0">
                <Star className="h-3 w-3 fill-amber-500" />
                {course.rating.toFixed(1)}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat icon={HelpCircle} label="Câu hỏi" value={overview.stats.questionCount} />
              <Stat icon={CheckCircle2} label="Đã giải" value={overview.stats.solvedCount} />
              <Stat icon={FileText} label="Tài liệu" value={overview.stats.documentCount} />
              <Stat icon={Users} label="Nhóm đang tuyển" value={overview.stats.recruitingGroupCount} />
            </div>

            <SlidingTabs<Tab>
              value={tab}
              onChange={setTab}
              items={[
                { id: 'posts', label: 'Thảo luận & Hỏi đáp' },
                { id: 'documents', label: 'Tài liệu & Đề thi', badge: c.documents.length || undefined },
                { id: 'groups', label: 'Nhóm học', badge: c.groups.length || undefined }
              ]}
            />
          </div>

          {tab === 'posts' && (
            <div>
              <div className="mx-2 sm:mx-0 mb-2.5 rounded-xl bg-card px-4 py-3">
                <AcademicPostComposer defaultCourseId={course.code} onPostCreated={c.addPost} />
              </div>
              {c.postsLoading ? (
                <FeedSkeleton count={2} className="px-2 sm:px-0" />
              ) : c.posts.length === 0 ? (
                <Empty icon={MessagesSquare} title="Chưa có thảo luận nào" hint={`Đặt câu hỏi đầu tiên cho ${course.code}!`} />
              ) : (
                <div className="px-2 sm:px-0">
                  <VirtualPostList posts={c.posts} cacheKey={`course:${course.code}`} renderPost={(post) => <PostCard post={post} variant="card" />} />
                </div>
              )}
              <div ref={sentinelRef} className="h-10 flex items-center justify-center">
                {c.isLoadingMorePosts && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
              </div>
            </div>
          )}

          {tab === 'documents' && <DocumentsBrowse courseCode={course.code} />}

          {tab === 'groups' && (
            <div className="px-2 sm:px-0 space-y-2.5">
              <Button variant="outline" size="sm" className="rounded-full gap-1.5" onClick={() => setCreateGroupOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Lập nhóm học
              </Button>
              {c.groupsLoading ? (
                <CardListSkeleton label="Đang tải nhóm học" />
              ) : c.groups.length === 0 ? (
                <Empty icon={Users} title="Chưa có nhóm học" hint="Lập nhóm ôn thi hoặc làm đồ án cùng bạn học." />
              ) : (
                c.groups.map((g) => <StudyGroupCard key={g.id} group={g} onJoin={c.joinGroup} />)
              )}
            </div>
          )}

          <PageAside>
            <div className="rounded-xl bg-card p-4 space-y-3">
              <p className="text-[13px] font-semibold">Đóng góp nhiều nhất</p>
              {overview.topContributors.length === 0 ? (
                <p className="text-xs text-muted-foreground">Chưa có ai đóng góp cho môn này.</p>
              ) : (
                overview.topContributors.map((u) => (
                  <Link key={u.id} href={`/${u.username}`} className="flex items-center gap-2.5 group">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={u.avatarUrl || ''} />
                      <AvatarFallback className="text-[10px] font-bold">{u.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate group-hover:text-primary">{u.displayName}</p>
                      <p className="text-[11px] text-muted-foreground">@{u.username}</p>
                    </div>
                    <span className="text-[11px] font-semibold text-muted-foreground">{u.contributions}</span>
                  </Link>
                ))
              )}
            </div>
          </PageAside>
        </>
      )}
    </>
  )
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-base font-bold tabular-nums mt-0.5">{value}</p>
    </div>
  )
}

function Empty({ icon: Icon, title, hint }: { icon: React.ElementType; title: string; hint: string }) {
  return (
    <div className="py-16 text-center text-muted-foreground space-y-2">
      <Icon className="h-10 w-10 mx-auto opacity-30 text-primary" />
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs">{hint}</p>
    </div>
  )
}
