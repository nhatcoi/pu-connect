'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/social/header'
import { Sidebar } from '@/components/social/sidebar'
import { RightSidebar } from '@/components/social/right-sidebar'
import { MobileBottomNav } from '@/components/navigation/mobile-bottom-nav'
import { PostCard } from '@/components/social/post-card'
import { DocumentCard } from '@/components/social/document-card'
import { StudyGroupCard } from '@/components/social/study-group-card'
import { DocumentPreviewModal } from '@/components/viewer/document-preview-modal'
import { FollowButton } from '@/components/profile/follow-button'
import { AcademicBadge } from '@/components/ui/academic-badge'
import { SearchSettingsDialog } from '@/components/search/search-settings-dialog'
import { SearchOptionsSheet } from '@/components/search/search-options-sheet'
import { AdvancedSearchDialog } from '@/components/search/advanced-search-dialog'
import { AuthGuard } from '@/components/auth/auth-guard'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useScrollDirection } from '@/hooks/use-scroll-direction'
import { apiClient } from '@/lib/api-client'
import { useAppStore } from '@/store'
import type {
  SearchResult,
  SearchType,
  Course,
  DocumentItem,
  PostItem,
  UserSummary,
  StudyGroup
} from '@pu/schemas'
import {
  Search,
  X,
  ArrowLeft,
  Settings,
  MoreHorizontal,
  SlidersHorizontal,
  TrendingUp,
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
  Award,
  Flame,
  CheckCircle2,
  Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'

const FACULTIES = [
  { code: 'ALL', name: 'Tất cả khoa' },
  { code: 'FIT', name: 'Khoa Công nghệ Thông tin (FIT)' },
  { code: 'FCS', name: 'Khoa Khoa học Máy tính (FCS)' },
  { code: 'FEE', name: 'Khoa Điện - Điện tử (FEE)' },
  { code: 'FBA', name: 'Khoa Kinh tế & QTKD (FBA)' },
  { code: 'FAE', name: 'Khoa Kỹ thuật Ô tô (FAE)' },
  { code: 'FMS', name: 'Khoa Y Dược (FMS)' },
  { code: 'FEL', name: 'Khoa Ngôn ngữ Anh (FEL)' },
  { code: 'FAS', name: 'Khoa Vật liệu & Công nghệ cao (FAS)' }
]

// Sample Trending Topics for Explore Feed (Matching X style)
const TRENDING_TOPICS = [
  {
    category: 'Khoa học Máy tính · Xu hướng',
    title: '#IT101 - Cấu trúc dữ liệu & Giải thuật',
    postsCount: '1.4K bài viết',
    tag: 'IT101'
  },
  {
    category: 'Đồ án tốt nghiệp · Xu hướng tại Phenikaa',
    title: '#DoAnTotNghiep2026',
    postsCount: '928 bài viết',
    tag: 'DoAnTotNghiep'
  },
  {
    category: 'Công nghệ AI · Xu hướng',
    title: '#MachineLearning - Phenikaa AI Lab',
    postsCount: '640 bài viết',
    tag: 'MachineLearning'
  },
  {
    category: 'Học phần đại cương · Xu hướng',
    title: '#GiaiTich2 - Đề thi thử giữa kỳ',
    postsCount: '512 bài viết',
    tag: 'GiaiTich2'
  },
  {
    category: 'Dự án PBL · Xu hướng',
    title: '#PBL3 - Tuyển thành viên lập trình nhúng',
    postsCount: '380 bài viết',
    tag: 'PBL3'
  },
  {
    category: 'Khoa Y Dược · Xu hướng',
    title: '#DuocLamSang - Tài liệu ôn thi',
    postsCount: '215 bài viết',
    tag: 'DuocLamSang'
  }
]

// Featured Academic News / Stories (Matching X "Today's News")
const ACADEMIC_STORIES = [
  {
    id: 1,
    title: 'Sinh viên FIT Phenikaa thảo luận chuẩn Benchmark mới cho AI Agents',
    category: 'Học thuật · Công nghệ',
    timeAgo: '2 giờ trước',
    postsCount: '263 bài thảo luận',
    avatars: ['https://api.dicebear.com/7.x/bottts/svg?seed=fit1', 'https://api.dicebear.com/7.x/bottts/svg?seed=fit2']
  },
  {
    id: 2,
    title: 'Tổng hợp kho đề thi thử và đáp án chi tiết các môn đại cương học kỳ 2',
    category: 'Tài liệu & Đề thi · Hot',
    timeAgo: '5 giờ trước',
    postsCount: '185 lượt tải về',
    avatars: ['https://api.dicebear.com/7.x/bottts/svg?seed=math1', 'https://api.dicebear.com/7.x/bottts/svg?seed=math2']
  },
  {
    id: 3,
    title: 'Hạn đăng ký nhóm đồ án PBL 2026 đợt 1 mở đến hết ngày 30/08',
    category: 'Nhóm đồ án PBL',
    timeAgo: '1 ngày trước',
    postsCount: '94 nhóm đang tuyển',
    avatars: ['https://api.dicebear.com/7.x/bottts/svg?seed=pbl1', 'https://api.dicebear.com/7.x/bottts/svg?seed=pbl2']
  }
]

function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const queryParam = searchParams.get('q') || ''
  const activeType = (searchParams.get('type') as SearchType) || 'all'
  const facultyParam = searchParams.get('faculty') || 'ALL'

  const [inputQuery, setInputQuery] = useState(queryParam)
  const [selectedFaculty, setSelectedFaculty] = useState(facultyParam)
  const [exploreSubTab, setExploreSubTab] = useState<'explore' | 'trending' | 'courses' | 'documents' | 'groups'>('explore')
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Dialog & Sheet States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isOptionsOpen, setIsOptionsOpen] = useState(false)
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)

  const user = useAppStore((state) => state.user)
  const previewDocument = useAppStore((state) => state.previewDocument)
  const setPreviewDocument = useAppStore((state) => state.setPreviewDocument)
  const { isHeaderVisible } = useScrollDirection(8)

  // Sync input query with URL
  useEffect(() => {
    setInputQuery(queryParam)
  }, [queryParam])

  // Perform search when query or type changes
  useEffect(() => {
    if (!queryParam.trim()) {
      setSearchResult(null)
      setIsLoading(false)
      return
    }

    async function performSearch() {
      setIsLoading(true)
      try {
        const facultyQuery = selectedFaculty !== 'ALL' ? `&faculty=${selectedFaculty}` : ''
        const res = await apiClient<{ success: boolean; data: SearchResult }>(
          `/search?q=${encodeURIComponent(queryParam.trim())}&type=${activeType}${facultyQuery}&limit=30`
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
  }, [queryParam, activeType, selectedFaculty])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputQuery.trim()) {
      router.push('/search')
      return
    }
    const facultyQuery = selectedFaculty !== 'ALL' ? `&faculty=${selectedFaculty}` : ''
    router.push(`/search?q=${encodeURIComponent(inputQuery.trim())}&type=${activeType}${facultyQuery}`)
  }

  const handleTabChange = (type: SearchType) => {
    const facultyQuery = selectedFaculty !== 'ALL' ? `&faculty=${selectedFaculty}` : ''
    router.push(`/search?q=${encodeURIComponent(queryParam)}&type=${type}${facultyQuery}`)
  }

  const handleFacultyChange = (code: string) => {
    setSelectedFaculty(code)
    const facultyQuery = code !== 'ALL' ? `&faculty=${code}` : ''
    router.push(`/search?q=${encodeURIComponent(queryParam)}&type=${activeType}${facultyQuery}`)
  }

  const handleTrendingClick = (tag: string) => {
    setInputQuery(tag)
    router.push(`/search?q=${encodeURIComponent(tag)}&type=all`)
  }

  const userInitials = (user?.displayName || (user as any)?.display_name || user?.username || 'PU')
    .slice(0, 2)
    .toUpperCase()

  const totalCount = searchResult?.counts?.total || 0
  const isSearchActive = !!queryParam.trim()

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
        {/* Top Header */}
        <Header />

        {/* In-App Document Preview Modal */}
        <DocumentPreviewModal
          document={previewDocument}
          open={!!previewDocument}
          onOpenChange={(open) => !open && setPreviewDocument(null)}
        />

        {/* Search Dialogs & Action Sheets */}
        <SearchSettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
        <SearchOptionsSheet
          open={isOptionsOpen}
          onOpenChange={setIsOptionsOpen}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenFilters={() => setIsAdvancedOpen(true)}
          onOpenAdvanced={() => setIsAdvancedOpen(true)}
        />
        <AdvancedSearchDialog
          open={isAdvancedOpen}
          onOpenChange={setIsAdvancedOpen}
          initialQuery={inputQuery}
          initialFaculty={selectedFaculty}
        />

        {/* Main 3-Column Layout (X Twitter Architecture) */}
        <div className="mx-auto flex justify-center max-w-7xl px-0 sm:px-4 lg:px-6 min-h-screen">
          {/* 1. Left Navigation Sidebar (Icon-only on md, full on xl) */}
          <div className="hidden md:flex shrink-0 w-16 xl:w-64 sticky top-14 h-[calc(100vh-3.5rem)] py-3 flex-col justify-between z-30">
            <Sidebar currentTab="search" />
          </div>

          {/* 2. Center Column (Wider for academic content, seamless continuous feed) */}
          <main className="flex-1 max-w-[700px] xl:max-w-[720px] w-full min-w-0 border-x border-border/80 min-h-screen pb-20 md:pb-12">
            
            {/* ── A. SEARCH TOP BAR & CATEGORY TABS ── */}
            <div className="sticky top-0 md:top-14 z-30 bg-background/95 backdrop-blur-md border-b border-border/80 px-3 py-2">
              {/* Desktop-only Search Input Row (Mobile search input is unified in Header) */}
              <div className="hidden md:flex items-center gap-2.5 pb-2">
                {isSearchActive && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputQuery('')
                      router.push('/search')
                    }}
                    className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted text-foreground cursor-pointer transition-colors shrink-0"
                    title="Quay lại khám phá"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                )}

                {/* Desktop Search Input */}
                <form onSubmit={handleSearchSubmit} className="flex-1 relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    placeholder="Tìm kiếm môn học, tài liệu, bài viết..."
                    className="w-full h-10 pl-10 pr-9 rounded-full bg-muted/60 hover:bg-muted focus:bg-background border border-transparent focus:border-primary text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all"
                  />
                  {inputQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setInputQuery('')
                        if (isSearchActive) router.push('/search')
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-muted-foreground/30 hover:bg-muted-foreground/50 text-foreground flex items-center justify-center cursor-pointer text-[10px]"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </form>

                {/* Desktop Right Action: Settings gear or 3-dots */}
                {isSearchActive ? (
                  <button
                    type="button"
                    onClick={() => setIsOptionsOpen(true)}
                    className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted text-foreground cursor-pointer transition-colors shrink-0"
                    title="Tùy chọn tìm kiếm"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted text-foreground cursor-pointer transition-colors shrink-0"
                    title="Cài đặt tìm kiếm"
                  >
                    <Settings className="h-5 w-5" />
                  </button>
                )}
              </div>

              {/* ── Category Tabs Bar ── */}
              {isSearchActive ? (
                /* Results Tabs (Top, Latest, Courses, Documents, People, Groups) */
                <div className="flex items-center justify-between text-xs font-bold pt-2 overflow-x-auto no-scrollbar -mx-3 px-3">
                  {[
                    { id: 'all' as SearchType, label: 'Hàng đầu (Top)' },
                    { id: 'posts' as SearchType, label: 'Mới nhất (Latest)' },
                    { id: 'courses' as SearchType, label: 'Môn học' },
                    { id: 'documents' as SearchType, label: 'Tài liệu' },
                    { id: 'users' as SearchType, label: 'Mọi người' },
                    { id: 'groups' as SearchType, label: 'Nhóm PBL' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={`relative py-2.5 px-3 text-center cursor-pointer whitespace-nowrap transition-colors ${
                        activeType === tab.id
                          ? 'text-foreground font-bold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {activeType === tab.id && (
                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-10 rounded-full bg-primary" />
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                /* Explore Sub-Tabs (Explore, Trending, Courses, Documents, Groups) */
                <div className="flex items-center justify-between text-xs font-bold pt-2 overflow-x-auto no-scrollbar -mx-3 px-3">
                  {[
                    { id: 'explore', label: 'Khám phá (Explore)' },
                    { id: 'trending', label: 'Xu hướng (Trending)' },
                    { id: 'courses', label: 'Môn học hot' },
                    { id: 'documents', label: 'Đề thi & Slide' },
                    { id: 'groups', label: 'Nhóm PBL' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setExploreSubTab(tab.id as any)}
                      className={`relative py-2.5 px-3 text-center cursor-pointer whitespace-nowrap transition-colors ${
                        exploreSubTab === tab.id
                          ? 'text-foreground font-bold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {exploreSubTab === tab.id && (
                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-10 rounded-full bg-primary" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── B. CONTENT RENDERER ── */}
            {isSearchActive ? (
              /* ── 1. ACTIVE SEARCH RESULTS STREAM (Image 2) ── */
              <div className="divide-y divide-border/60">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    <p className="text-xs">Đang tìm kiếm dữ liệu học thuật cho &ldquo;{queryParam}&rdquo;...</p>
                  </div>
                ) : totalCount === 0 ? (
                  <div className="py-20 px-6 text-center space-y-3">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                      <Search className="h-6 w-6" />
                    </div>
                    <h3 className="text-base font-bold text-foreground">
                      Không tìm thấy kết quả cho &ldquo;{queryParam}&rdquo;
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Hãy thử tìm kiếm với từ khóa khác, mã học phần ngắn gọn (ví dụ: <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">IT101</code>) hoặc sử dụng tính năng Tìm kiếm nâng cao.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsAdvancedOpen(true)}
                      className="rounded-full text-xs font-semibold mt-2 cursor-pointer"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                      Tìm kiếm nâng cao
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Courses Match List */}
                    {searchResult?.courses && searchResult.courses.length > 0 && (
                      <div className="p-3 sm:p-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <GraduationCap className="h-4 w-4 text-primary" />
                            <span>Môn học phù hợp ({searchResult.courses.length})</span>
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {searchResult.courses.map((course) => (
                            <CourseCardItem key={course.id} course={course} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Users / People Match List */}
                    {searchResult?.users && searchResult.users.length > 0 && (
                      <div className="p-3 sm:p-4 space-y-2.5">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <User className="h-4 w-4 text-primary" />
                          <span>Người dùng & Giảng viên ({searchResult.users.length})</span>
                        </h3>
                        <div className="divide-y divide-border/40 rounded-2xl border border-border bg-card/60 overflow-hidden">
                          {searchResult.users.map((u) => (
                            <UserCardItem key={u.id} userItem={u} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Documents Match List */}
                    {searchResult?.documents && searchResult.documents.length > 0 && (
                      <div className="p-3 sm:p-4 space-y-2.5">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <FileText className="h-4 w-4 text-primary" />
                          <span>Đề thi & Tài liệu ({searchResult.documents.length})</span>
                        </h3>
                        <div className="space-y-2">
                          {searchResult.documents.map((doc) => (
                            <DocumentCard key={doc.id} document={doc} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Study Groups Match List */}
                    {searchResult?.groups && searchResult.groups.length > 0 && (
                      <div className="p-3 sm:p-4 space-y-2.5">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Users className="h-4 w-4 text-primary" />
                          <span>Nhóm đồ án PBL ({searchResult.groups.length})</span>
                        </h3>
                        <div className="space-y-2">
                          {searchResult.groups.map((group) => (
                            <StudyGroupCard key={group.id} group={group} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Academic Posts Stream */}
                    {searchResult?.posts && searchResult.posts.length > 0 && (
                      <div>
                        {searchResult.posts.map((post) => (
                          <PostCard key={post.id} post={post} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              /* ── 2. EXPLORE & TRENDING LANDING STREAM (Image 1) ── */
              <div className="divide-y divide-border/60">
                {/* Section 1: Today's Academic News (Image 1) */}
                <div className="p-3 sm:p-4 space-y-3">
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-foreground">
                    Tin nổi bật Phenikaa (Today&apos;s Highlights)
                  </h2>
                  <div className="space-y-3">
                    {ACADEMIC_STORIES.map((story) => (
                      <div
                        key={story.id}
                        onClick={() => handleTrendingClick(story.title.split(' ')[0])}
                        className="p-3 rounded-2xl border border-border/80 bg-card hover:bg-muted/30 transition-colors cursor-pointer space-y-1.5"
                      >
                        <h3 className="text-sm font-bold text-foreground leading-snug hover:underline">
                          {story.title}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium">{story.timeAgo}</span>
                          <span>•</span>
                          <span>{story.category}</span>
                          <span>•</span>
                          <span className="font-semibold text-primary">{story.postsCount}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 2: Trending Topics (Image 1) */}
                <div className="p-3 sm:p-4 space-y-2">
                  <div className="flex items-center justify-between pb-1">
                    <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Flame className="h-4 w-4 text-amber-500" />
                      <span>Xu hướng thảo luận tại Phenikaa</span>
                    </h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsSettingsOpen(true)}
                      className="h-7 text-[11px] rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <Settings className="h-3.5 w-3.5 mr-1" />
                      Cài đặt
                    </Button>
                  </div>

                  <div className="divide-y divide-border/40">
                    {TRENDING_TOPICS.map((topic, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleTrendingClick(topic.tag)}
                        className="py-3 flex items-start justify-between group cursor-pointer"
                      >
                        <div className="space-y-0.5 min-w-0 pr-2">
                          <p className="text-[11px] text-muted-foreground">{topic.category}</p>
                          <p className="text-sm font-bold text-foreground group-hover:underline truncate">
                            {topic.title}
                          </p>
                          <p className="text-xs text-muted-foreground">{topic.postsCount}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setIsOptionsOpen(true)
                          }}
                          className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 3: Popular Courses Grid */}
                <div className="p-3 sm:p-4 space-y-3">
                  <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    <span>Học phần được quan tâm nhiều nhất</span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      { code: 'IT101', name: 'Cấu trúc dữ liệu & Giải thuật', credits: 3, faculty: 'FIT' },
                      { code: 'MATH201', name: 'Giải tích 2', credits: 3, faculty: 'FAS' },
                      { code: 'AI302', name: 'Học máy & Xử lý ngôn ngữ tự nhiên', credits: 4, faculty: 'FIT' },
                      { code: 'FEE204', name: 'Kỹ thuật vi xử lý & IoT', credits: 3, faculty: 'FEE' }
                    ].map((course) => (
                      <button
                        key={course.code}
                        onClick={() => handleTrendingClick(course.code)}
                        className="p-3 rounded-2xl border border-border bg-card hover:border-primary/50 text-left transition-all cursor-pointer space-y-1.5 group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                            {course.code}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium">{course.credits} tín chỉ</span>
                        </div>
                        <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                          {course.name}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </main>

          {/* 3. Right Sidebar (Desktop lg: only) */}
          <div className="hidden lg:block w-72 xl:w-80 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-4 pl-4 xl:pl-6 space-y-4">
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
                💡 Mẹo tìm kiếm thông minh
              </span>
              <ul className="text-muted-foreground space-y-1.5 text-[11px] list-disc list-inside">
                <li>Tìm mã môn chính xác: <code className="bg-muted px-1 py-0.5 rounded text-foreground">IT101</code></li>
                <li>Tìm theo thẻ hashtag: <code className="bg-muted px-1 py-0.5 rounded text-foreground">#DoAnTotNghiep</code></li>
                <li>Tìm tài liệu theo khoa: Chọn bộ lọc ở trên.</li>
              </ul>
            </Card>
          </div>
        </div>

        {/* Mobile Bottom Navigation Bar */}
        <MobileBottomNav />
      </div>
    </AuthGuard>
  )
}

function CourseCardItem({ course }: { course: Course }) {
  const router = useRouter()
  return (
    <div
      onClick={() => router.push(`/home?tab=courses`)}
      className="p-3 rounded-2xl border border-border bg-card hover:border-primary/50 text-card-foreground transition-all cursor-pointer space-y-1.5"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary">
          {course.code}
        </span>
        <span className="text-[10px] font-medium text-muted-foreground">
          {course.credits} tín chỉ
        </span>
      </div>
      <h4 className="font-bold text-xs text-foreground line-clamp-1">
        {course.name}
      </h4>
      {course.description && (
        <p className="text-[11px] text-muted-foreground line-clamp-2">
          {course.description}
        </p>
      )}
    </div>
  )
}

function UserCardItem({ userItem }: { userItem: UserSummary }) {
  const router = useRouter()
  const initials = (userItem.displayName || userItem.username || 'PU')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
      <div
        onClick={() => router.push(`/${userItem.username}`)}
        className="flex items-center gap-3 cursor-pointer min-w-0"
      >
        <Avatar className="h-10 w-10 border border-border">
          <AvatarImage src={userItem.avatarUrl || ''} />
          <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-xs text-foreground hover:underline truncate">
              {userItem.displayName || userItem.username}
            </span>
            <AcademicBadge
              role={userItem.role}
              reputationPoints={userItem.reputationPoints}
            />
          </div>
          <p className="text-[11px] text-muted-foreground truncate">
            @{userItem.username}
          </p>
        </div>
      </div>

      <div className="shrink-0 ml-3">
        <FollowButton
          targetUserId={userItem.id}
          targetUsername={userItem.username}
          initialIsFollowing={userItem.isFollowedByMe ?? false}
          size="sm"
        />
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <SearchContent />
    </Suspense>
  )
}
