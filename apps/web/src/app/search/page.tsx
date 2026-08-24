'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/social/header'
import { Sidebar } from '@/components/social/sidebar'
import { MobileBottomNav } from '@/components/navigation/mobile-bottom-nav'
import { PostCard } from '@/components/social/post-card'
import { DocumentCard } from '@/components/social/document-card'
import { DocumentPreviewModal } from '@/components/viewer/document-preview-modal'
import { FollowButton } from '@/components/profile/follow-button'
import { AcademicSearchBar } from '@/components/search/academic-search-bar'
import { AuthGuard } from '@/components/auth/auth-guard'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { apiClient } from '@/lib/api-client'
import { useAppStore } from '@/store'
import type { SearchResult, SearchType, Course, DocumentItem, PostItem, UserSummary, StudyGroup } from '@pu/schemas'
import {
  Search,
  BookOpen,
  FileText,
  MessageSquare,
  User,
  Users,
  Sparkles,
  Filter,
  ArrowRight,
  Loader2,
  GraduationCap,
  Star,
  Award
} from 'lucide-react'
import { cn } from '@/lib/utils'

const FACULTIES = [
  { code: 'ALL', name: 'Tất cả khoa' },
  { code: 'FIT', name: 'Khoa Công nghệ Thông tin' },
  { code: 'FCS', name: 'Khoa Khoa học Máy tính' },
  { code: 'FEE', name: 'Khoa Điện - Điện tử' },
  { code: 'FBA', name: 'Khoa Kinh tế & QTKD' },
  { code: 'FAE', name: 'Khoa Kỹ thuật Ô tô' },
  { code: 'FMS', name: 'Khoa Y Dược' },
  { code: 'FEL', name: 'Khoa Ngôn ngữ Anh' },
  { code: 'FAS', name: 'Khoa Vật liệu & Công nghệ cao' }
]

function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const query = searchParams.get('q') || ''
  const activeType = (searchParams.get('type') as SearchType) || 'all'
  const facultyParam = searchParams.get('faculty') || 'ALL'

  const [selectedFaculty, setSelectedFaculty] = useState(facultyParam)
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const previewDocument = useAppStore((state) => state.previewDocument)
  const setPreviewDocument = useAppStore((state) => state.setPreviewDocument)

  useEffect(() => {
    async function performSearch() {
      if (!query.trim()) {
        setSearchResult(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const facultyQuery = selectedFaculty !== 'ALL' ? `&faculty=${selectedFaculty}` : ''
        const res = await apiClient<{ success: boolean; data: SearchResult }>(
          `/search?q=${encodeURIComponent(query.trim())}&type=${activeType}${facultyQuery}&limit=30`
        )
        if (res && res.data) {
          setSearchResult(res.data)
        }
      } catch {
        setSearchResult(null)
      } finally {
        setIsLoading(false)
      }
    }

    performSearch()
  }, [query, activeType, selectedFaculty])

  const handleTabChange = (type: SearchType) => {
    const facultyQuery = selectedFaculty !== 'ALL' ? `&faculty=${selectedFaculty}` : ''
    router.push(`/search?q=${encodeURIComponent(query)}&type=${type}${facultyQuery}`)
  }

  const handleFacultyChange = (code: string) => {
    setSelectedFaculty(code)
    const facultyQuery = code !== 'ALL' ? `&faculty=${code}` : ''
    router.push(`/search?q=${encodeURIComponent(query)}&type=${activeType}${facultyQuery}`)
  }

  const totalCount = searchResult?.counts?.total || 0

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <Header />
      <DocumentPreviewModal
        document={previewDocument}
        open={!!previewDocument}
        onOpenChange={(open) => !open && setPreviewDocument(null)}
      />

      <div className="mx-auto flex justify-center max-w-7xl px-0 sm:px-4 lg:px-6 min-h-screen">
        {/* 1. Left Navigation Sidebar (Icon-only on md, full on xl) */}
        <div className="hidden md:flex shrink-0 w-16 xl:w-64 sticky top-14 h-[calc(100vh-3.5rem)] py-3 flex-col justify-between z-30">
          <Sidebar currentTab="feed" />
        </div>

        {/* 2. Center Search Results Feed (Max 620px) */}
        <main className="flex-1 max-w-[620px] w-full min-w-0 border-x border-border/80 min-h-screen pb-20 md:pb-12 p-3 sm:p-4 space-y-4">
            {/* Search Header Banner */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Search className="h-4 w-4 text-primary" />
                    <span>Kết quả tìm kiếm cho &ldquo;{query}&rdquo;</span>
                  </h1>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isLoading ? 'Đang tìm kiếm dữ liệu học thuật...' : `Tìm thấy ${totalCount} kết quả phù hợp`}
                  </p>
                </div>

                {selectedFaculty !== 'ALL' && (
                  <Badge variant="secondary" className="text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                    Khoa: {selectedFaculty}
                  </Badge>
                )}
              </div>

              {/* In-page Search Bar */}
              <div className="w-full">
                <AcademicSearchBar initialQuery={query} />
              </div>

              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar border-t border-border">
                <button
                  onClick={() => handleTabChange('all')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
                    activeType === 'all'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Tất cả</span>
                  {searchResult && <span className="opacity-80">({searchResult.counts.total})</span>}
                </button>

                <button
                  onClick={() => handleTabChange('courses')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
                    activeType === 'courses'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>Môn học</span>
                  {searchResult && <span className="opacity-80">({searchResult.counts.courses})</span>}
                </button>

                <button
                  onClick={() => handleTabChange('documents')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
                    activeType === 'documents'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Đề thi & Tài liệu</span>
                  {searchResult && <span className="opacity-80">({searchResult.counts.documents})</span>}
                </button>

                <button
                  onClick={() => handleTabChange('posts')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
                    activeType === 'posts'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Bài viết Q&A</span>
                  {searchResult && <span className="opacity-80">({searchResult.counts.posts})</span>}
                </button>

                <button
                  onClick={() => handleTabChange('users')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
                    activeType === 'users'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <User className="h-3.5 w-3.5" />
                  <span>Mọi người</span>
                  {searchResult && <span className="opacity-80">({searchResult.counts.users})</span>}
                </button>

                <button
                  onClick={() => handleTabChange('groups')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
                    activeType === 'groups'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Nhóm PBL</span>
                  {searchResult && <span className="opacity-80">({searchResult.counts.groups})</span>}
                </button>
              </div>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground font-medium">Đang tìm kiếm thông tin học thuật...</span>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && (!searchResult || totalCount === 0) && (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Search className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-foreground">Không tìm thấy kết quả nào cho &ldquo;{query}&rdquo;</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Hãy thử kiểm tra lại chính tả, tìm bằng mã học phần (ví dụ: IT101), hoặc chọn &ldquo;Tất cả khoa&rdquo; ở cột bên phải.
                </p>
              </div>
            )}

            {/* Search Results Content */}
            {!isLoading && searchResult && totalCount > 0 && (
              <div className="space-y-4">
                {/* ── ALL TAB / TOP RESULTS ── */}
                {activeType === 'all' && (
                  <>
                    {/* Courses Section */}
                    {searchResult.courses.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <BookOpen className="h-3.5 w-3.5 text-primary" /> Học phần liên quan
                          </span>
                          <button
                            onClick={() => handleTabChange('courses')}
                            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            Xem tất cả ({searchResult.counts.courses}) <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {searchResult.courses.map((course) => (
                            <CourseCardItem key={course.id} course={course} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Documents & Exam Papers Section */}
                    {searchResult.documents.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-primary" /> Đề thi & Tài liệu
                          </span>
                          <button
                            onClick={() => handleTabChange('documents')}
                            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            Xem tất cả ({searchResult.counts.documents}) <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {searchResult.documents.map((doc) => (
                            <DocumentCard key={doc.id} document={doc} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Posts Section */}
                    {searchResult.posts.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <MessageSquare className="h-3.5 w-3.5 text-primary" /> Thảo luận & Hỏi đáp
                          </span>
                          <button
                            onClick={() => handleTabChange('posts')}
                            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            Xem tất cả ({searchResult.counts.posts}) <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="space-y-3">
                          {searchResult.posts.map((post) => (
                            <PostCard key={post.id} post={post} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Users Section */}
                    {searchResult.users.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-primary" /> Mọi người
                          </span>
                          <button
                            onClick={() => handleTabChange('users')}
                            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            Xem tất cả ({searchResult.counts.users}) <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {searchResult.users.map((user) => (
                            <UserCardItem key={user.id} user={user} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Study Groups Section */}
                    {searchResult.groups.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-primary" /> Nhóm đồ án PBL
                          </span>
                          <button
                            onClick={() => handleTabChange('groups')}
                            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            Xem tất cả ({searchResult.counts.groups}) <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {searchResult.groups.map((group) => (
                            <GroupCardItem key={group.id} group={group} />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* ── COURSES ONLY TAB ── */}
                {activeType === 'courses' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {searchResult.courses.map((course) => (
                      <CourseCardItem key={course.id} course={course} />
                    ))}
                  </div>
                )}

                {/* ── DOCUMENTS ONLY TAB ── */}
                {activeType === 'documents' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {searchResult.documents.map((doc) => (
                      <DocumentCard key={doc.id} document={doc} />
                    ))}
                  </div>
                )}

                {/* ── POSTS ONLY TAB ── */}
                {activeType === 'posts' && (
                  <div className="space-y-3">
                    {searchResult.posts.map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </div>
                )}

                {/* ── USERS ONLY TAB ── */}
                {activeType === 'users' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {searchResult.users.map((user) => (
                      <UserCardItem key={user.id} user={user} />
                    ))}
                  </div>
                )}

                {/* ── GROUPS ONLY TAB ── */}
                {activeType === 'groups' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {searchResult.groups.map((group) => (
                      <GroupCardItem key={group.id} group={group} />
                    ))}
                  </div>
                )}
              </div>
            )}
        </main>

        {/* 3. Right Filters & Faculties Sidebar (Desktop lg: only) */}
        <aside className="hidden lg:block w-72 xl:w-80 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-4 pl-4 xl:pl-6 space-y-4">
          {/* Faculty Filter Card */}
          <Card className="border-border bg-card shadow-xs rounded-2xl">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Filter className="h-4 w-4 text-primary" />
                <span>Lọc theo Khoa / Viện</span>
              </div>
            </CardHeader>
            <CardContent className="p-2 space-y-0.5">
              {FACULTIES.map((fac) => {
                const isSelected = selectedFaculty === fac.code
                return (
                  <button
                    key={fac.code}
                    onClick={() => handleFacultyChange(fac.code)}
                    className={cn(
                      'w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors cursor-pointer text-left',
                      isSelected
                        ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <span className="truncate">{fac.name}</span>
                    {fac.code !== 'ALL' && (
                      <span
                        className={cn(
                          'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ml-2 shrink-0',
                          isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {fac.code}
                      </span>
                    )}
                  </button>
                )
              })}
            </CardContent>
          </Card>

          {/* Search Tips */}
          <Card className="border-border bg-card shadow-xs p-3.5 space-y-2 text-xs rounded-2xl">
            <span className="font-bold text-foreground flex items-center gap-1.5">
              💡 Mẹo tìm kiếm hiệu quả
            </span>
            <ul className="text-muted-foreground space-y-1.5 text-[11px] list-disc list-inside">
              <li>Tìm mã môn học chính xác: <code className="bg-muted px-1 py-0.5 rounded text-foreground">IT101</code></li>
              <li>Tìm đề thi theo từ khóa: <code className="bg-muted px-1 py-0.5 rounded text-foreground">Đề thi Giải tích</code></li>
              <li>Tìm bài viết theo thẻ tag: <code className="bg-muted px-1 py-0.5 rounded text-foreground">#DoAnTotNghiep</code></li>
            </ul>
          </Card>
        </aside>
      </div>

      {/* Mobile Bottom Navigation Bar & FAB */}
      <MobileBottomNav />
    </div>
  )
}

function CourseCardItem({ course }: { course: Course }) {
  return (
    <Card className="border-border bg-card text-card-foreground p-3.5 hover:border-primary/50 transition-all shadow-xs flex flex-col justify-between">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <Badge variant="outline" className="font-mono text-xs font-bold text-primary border-primary/30 bg-primary/5">
            {course.code}
          </Badge>
          <span className="text-[11px] text-muted-foreground font-medium">{course.credits} tín chỉ</span>
        </div>
        <h4 className="font-bold text-xs text-foreground leading-snug line-clamp-2">{course.name}</h4>
        {course.description && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{course.description}</p>
        )}
      </div>
      <div className="pt-3 mt-2 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{course.documentCount} tài liệu</span>
        <Link
          href={`/home?tab=courses&course=${course.code}`}
          className="text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
        >
          Vào môn học <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </Card>
  )
}

function UserCardItem({ user }: { user: UserSummary }) {
  const authorInitials = (user.displayName || user.username).slice(0, 2).toUpperCase()
  return (
    <Card className="border-border bg-card text-card-foreground p-3.5 hover:border-border/80 transition-all shadow-xs flex items-center justify-between">
      <Link href={`/${user.username}`} className="flex items-center gap-3 group cursor-pointer truncate">
        <Avatar className="h-10 w-10 border border-border">
          <AvatarImage src={user.avatarUrl || ''} alt={user.displayName} />
          <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">{authorInitials}</AvatarFallback>
        </Avatar>
        <div className="truncate">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-bold text-xs text-foreground group-hover:underline truncate">{user.displayName}</span>
            {user.role === 'lecturer' && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 bg-muted text-muted-foreground">
                Giảng viên
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>@{user.username}</span>
            <span>•</span>
            <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-semibold">
              <Award className="h-3 w-3" /> {user.reputationPoints}
            </span>
          </div>
        </div>
      </Link>
      <div className="shrink-0 pl-2">
        <FollowButton targetUserId={user.id} initialIsFollowing={user.isFollowedByMe} />
      </div>
    </Card>
  )
}

function GroupCardItem({ group }: { group: StudyGroup }) {
  return (
    <Card className="border-border bg-card text-card-foreground p-3.5 hover:border-border/80 transition-all shadow-xs flex flex-col justify-between space-y-2">
      <div>
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary" className="text-[10px] font-semibold bg-primary/10 text-primary">
            {group.courseCode || 'PBL'}
          </Badge>
          <span className="text-[10px] text-muted-foreground font-medium">
            {group.currentMembersCount}/{group.maxMembers} thành viên
          </span>
        </div>
        <h4 className="font-bold text-xs text-foreground mt-1.5 line-clamp-1">{group.name}</h4>
        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{group.topic || group.description}</p>
      </div>
      {group.techStack && group.techStack.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {group.techStack.slice(0, 3).map((tech) => (
            <span key={tech} className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono">
              {tech}
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}

export default function SearchPage() {
  return (
    <AuthGuard>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
      >
        <SearchContent />
      </Suspense>
    </AuthGuard>
  )
}
