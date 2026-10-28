'use client'

import React, { use, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, BookOpen, Loader2, MessagesSquare, Plus, Share2, Star, Upload, Users } from 'lucide-react'
import { toast } from 'sonner'
import { AcademicPostComposer } from '@/components/social/composer/academic-post-composer'
import { PostCard } from '@/components/social/post-card'
import { VirtualPostList } from '@/components/social/virtual-post-list'
import { CoursePath } from '@/components/documents/course-path'
import { DocumentsBrowse } from '@/components/documents/documents-browse'
import { StudyGroupCard } from '@/components/social/study-group-card'
import { SlidingTabs } from '@/components/navigation/sliding-tabs'
import { DocumentRow } from '@/components/documents/document-row'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useCourse } from '@/hooks/use-course'
import { useFollowedCourseIds, useToggleFollowCourse } from '@/hooks/use-course-follow'
import { useDocumentBrowse } from '@/hooks/use-document-library'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { CardListSkeleton, CourseHeaderSkeleton } from '@/components/skeletons/catalog-skeleton'
import { FeedSkeleton, PostListSkeleton } from '@/components/skeletons/feed-skeleton'
import { LoadingRegion } from '@/components/ui/skeleton'

type Tab = 'posts' | 'path' | 'documents' | 'groups'

// Trang học phần: thảo luận & hỏi đáp, tài liệu/đề thi, nhóm học theo mã môn
export default function CoursePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const courseCode = decodeURIComponent(code).toUpperCase()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('posts')
  const setCreateGroupOpen = useAppStore((s) => s.setCreateGroupOpen)
  const setCreateDocumentOpen = useAppStore((s) => s.setCreateDocumentOpen)
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
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => router.push('/documents')}>
          Xem danh mục môn học
        </Button>
      </div>
    )
  }

  const overview = c.overview
  const course = overview?.course

  return (
    <>
      <div className="sticky top-0 md:top-14 z-30 bg-surface/90 backdrop-blur-md px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0" onClick={() => router.back()} aria-label="Quay lại">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <p className="text-[13px] text-muted-foreground">
          <Link href="/documents" className="hover:text-foreground hover:underline">
            Môn học & Tài liệu
          </Link>
          <span className="mx-1.5">/</span>
          <span className="font-medium text-foreground">{course ? course.name : courseCode}</span>
        </p>
      </div>

      {c.isLoading || !overview || !course ? (
        <LoadingRegion label={`Đang tải học phần ${courseCode}`}>
          <CourseHeaderSkeleton />
          <PostListSkeleton className="px-2 sm:px-0" />
        </LoadingRegion>
      ) : (
        <>
          <div className="mx-2 sm:mx-0 mb-3 space-y-4 border-b border-border px-1 pb-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <h2 className="text-xl font-bold tracking-tight">{course.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {course.credits} tín chỉ{course.fieldName ? ` · ${course.fieldName}` : ''}
                </p>
                {course.description && <p className="max-w-2xl pt-1 text-sm leading-relaxed text-muted-foreground">{course.description}</p>}
                <p className="pt-1 text-xs text-muted-foreground">
                  {overview.stats.questionCount} câu hỏi ({overview.stats.solvedCount} đã giải) · {overview.stats.documentCount} tài liệu ·{' '}
                  {overview.stats.groupCount} nhóm học
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <FollowButton courseId={course.id} />
                <Button size="sm" className="h-8 gap-1.5 rounded-lg text-xs" onClick={() => setCreateDocumentOpen(true)}>
                  <Upload className="h-3.5 w-3.5" /> Tải tài liệu lên
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg text-xs" onClick={handleShare}>
                  <Share2 className="h-3.5 w-3.5" /> Chia sẻ
                </Button>
              </div>
            </div>

            <SlidingTabs<Tab>
              value={tab}
              onChange={setTab}
              items={[
                { id: 'posts', label: 'Thảo luận & Hỏi đáp' },
                { id: 'path', label: 'Lộ trình học' },
                { id: 'documents', label: 'Tài liệu & Đề thi', badge: overview.stats.documentCount || undefined },
                { id: 'groups', label: 'Nhóm học', badge: c.groups.length || undefined }
              ]}
            />
          </div>

          {tab === 'posts' && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0">
                <div className="mx-2 sm:mx-0 mb-2.5 rounded-xl bg-card px-4 py-3">
                  <AcademicPostComposer defaultCourseId={course.code} onPostCreated={c.addPost} />
                </div>
                {c.postsLoading ? (
                  <FeedSkeleton count={2} className="px-2 sm:px-0" />
                ) : c.posts.length === 0 ? (
                  <Empty icon={MessagesSquare} title="Chưa có thảo luận nào" hint={`Đặt câu hỏi đầu tiên cho ${course.name}!`} />
                ) : (
                  <div className="px-2 sm:px-0">
                    <VirtualPostList posts={c.posts} cacheKey={`course:${course.code}`} renderPost={(post) => <PostCard post={post} variant="card" />} />
                  </div>
                )}
                <div ref={sentinelRef} className="h-10 flex items-center justify-center">
                  {c.isLoadingMorePosts && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                </div>
              </div>
              <aside className="space-y-4 px-2 sm:px-0 lg:sticky lg:top-28 lg:self-start">
                <TopDocuments courseCode={course.code} onSeeAll={() => setTab('documents')} onUpload={() => setCreateDocumentOpen(true)} />
                <Contributors users={overview.topContributors} />
              </aside>
            </div>
          )}

          {tab === 'path' && <CoursePath courseCode={course.code} onSeeAll={() => setTab('documents')} />}

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
        </>
      )}
    </>
  )
}

function FollowButton({ courseId }: { courseId: string }) {
  const { data: ids = [] } = useFollowedCourseIds()
  const toggle = useToggleFollowCourse()
  const followed = ids.includes(courseId)
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 rounded-lg text-xs"
      aria-pressed={followed}
      onClick={() => toggle.mutate({ courseId, follow: !followed })}
    >
      <Star className={cn('h-3.5 w-3.5', followed && 'fill-foreground')} /> {followed ? 'Đang theo dõi' : 'Theo dõi'}
    </Button>
  )
}

// Tài liệu nổi bật của môn (nhiều lượt tải) ở cột phải tab Thảo luận
function TopDocuments({ courseCode, onSeeAll, onUpload }: { courseCode: string; onSeeAll: () => void; onUpload: () => void }) {
  const browse = useDocumentBrowse({ course: courseCode, sort: 'popular' })
  const docs = browse.items.slice(0, 5)
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h3 className="text-[13px] font-semibold">Tài liệu của môn</h3>
        <button type="button" onClick={onSeeAll} className="text-[11px] text-muted-foreground hover:text-foreground hover:underline cursor-pointer">
          Xem tất cả
        </button>
      </div>
      {browse.isPending ? (
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">Đang tải…</p>
      ) : docs.length === 0 ? (
        <div className="space-y-2 px-3 py-6 text-center">
          <p className="text-xs text-muted-foreground">Chưa có tài liệu nào cho môn này.</p>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg text-xs" onClick={onUpload}>
            <Plus className="h-3.5 w-3.5" /> Đăng tài liệu đầu tiên
          </Button>
        </div>
      ) : (
        <div className="space-y-0.5 p-1.5">
          {docs.map((d) => (
            <DocumentRow key={d.id} document={d} />
          ))}
        </div>
      )}
    </section>
  )
}

// Huy hiệu theo số đóng góp (bài + tài liệu) cho môn này
function contributorTier(n: number) {
  if (n >= 10) return 'Chuyên gia môn'
  if (n >= 3) return 'Tích cực'
  return 'Mới đóng góp'
}

function Contributors({ users }: { users: { id: string; username: string; displayName: string; avatarUrl?: string | null; contributions: number }[] }) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <h3 className="border-b border-border px-3 py-2 text-[13px] font-semibold">Đóng góp nhiều nhất</h3>
      {users.length === 0 ? (
        <p className="px-3 py-4 text-xs text-muted-foreground">Chưa có ai đóng góp cho môn này.</p>
      ) : (
        <div className="space-y-2.5 p-3">
          {users.map((u) => (
            <Link key={u.id} href={`/${u.username}`} className="group flex items-center gap-2.5">
              <Avatar className="h-7 w-7">
                <AvatarImage src={u.avatarUrl || ''} />
                <AvatarFallback className="text-[10px] font-bold">{u.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold group-hover:underline">{u.displayName}</p>
                <p className="text-[11px] text-muted-foreground">@{u.username}</p>
              </div>
              <span className="flex flex-col items-end">
                <span className="text-[11px] tabular-nums text-muted-foreground">{u.contributions}</span>
                <span className="text-[10px] font-semibold text-primary">{contributorTier(u.contributions)}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

function Empty({ icon: Icon, title, hint }: { icon: React.ElementType; title: string; hint: string }) {
  return (
    <div className="py-16 text-center text-muted-foreground space-y-2">
      <Icon className="h-10 w-10 mx-auto opacity-30" />
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs">{hint}</p>
    </div>
  )
}
