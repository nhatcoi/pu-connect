'use client'

import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { prefetchCommunity } from '@/hooks/use-community'
import type { Community } from '@pu/schemas'
import {
  Compass,
  Search,
  Users,
  MessageSquare,
  ArrowRight,
  Sparkles,
  Loader2,
  Check,
  UserPlus,
  Flame,
  ArrowLeft
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { CommunityCardsSkeleton } from '@/components/skeletons/catalog-skeleton'

const CATEGORIES = [
  { id: 'all', label: 'Tất cả' },
  { id: 'campus', label: '🏛️ Đại sảnh' },
  { id: 'faculty', label: '🎓 Khoa / Viện' },
  { id: 'academic', label: '📚 Học thuật & Đồ án' },
  { id: 'life', label: '🏡 Đời sống & Nhà trọ' },
  { id: 'club', label: '⚽ Câu lạc bộ' }
]

export default function CommunitiesDirectoryPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [selectedType, setSelectedType] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  // Từ khóa đã gửi (chỉ tìm khi bấm Enter, không tìm theo từng phím)
  const [appliedSearch, setAppliedSearch] = useState('')
  const [joiningSlug, setJoiningSlug] = useState<string | null>(null)

  // Cache theo (loại, từ khóa): quay lại trang hiện ngay, không tải lại
  const listKey = [...queryKeys.communities, selectedType, appliedSearch.trim()] as const
  const { data: communities = [], isPending: isLoading } = useQuery({
    queryKey: listKey,
    queryFn: async () => {
      const queryParams = new URLSearchParams()
      if (selectedType !== 'all') queryParams.set('type', selectedType)
      if (appliedSearch.trim()) queryParams.set('search', appliedSearch.trim())
      const res = await apiClient<{ success: boolean; data: Community[] }>(`/communities?${queryParams.toString()}`)
      return res.data
    },
    staleTime: 2 * 60 * 1000
  })

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setAppliedSearch(searchQuery)
  }

  const handleToggleJoin = async (slug: string) => {
    setJoiningSlug(slug)
    try {
      const res = await apiClient<{ isMember: boolean; membersCount: number; message: string }>(
        `/communities/${slug}/join`,
        { method: 'POST' }
      )
      // Cập nhật mọi danh sách cộng đồng đã cache + trang chi tiết cộng đồng
      queryClient.setQueriesData<Community[]>({ queryKey: queryKeys.communities }, (prev) =>
        prev?.map((c) => (c.slug === slug ? { ...c, isMember: res.isMember, membersCount: res.membersCount } : c))
      )
      queryClient.invalidateQueries({ queryKey: queryKeys.communityAll(slug) })
      toast.success(res.message)
    } catch (err: any) {
      toast.error(err.message || 'Thao tác không thành công')
    } finally {
      setJoiningSlug(null)
    }
  }

  return (
    <>
      {/* Header */}
      <div className="sticky top-0 md:top-14 z-30 bg-surface/90 backdrop-blur-md px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full hover:bg-muted cursor-pointer shrink-0"
            onClick={() => router.push('/home')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight text-foreground leading-none flex items-center gap-2">
              <Compass className="h-4 w-4 text-primary" />
              Cộng Đồng & Diễn Đàn Phenikaa
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Khám phá và tham gia các tiểu cộng đồng theo khoa, sở thích và đồ án
            </p>
          </div>
        </div>
      </div>

      {/* Search and Category Filters */}
      <div className="mx-2 sm:mx-0 mb-2.5 rounded-xl bg-card p-4 space-y-3">
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Tìm kiếm theo tên cộng đồng, mô tả hoặc c/slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9 rounded-full bg-muted/60 border-transparent text-[13px] focus-visible:ring-primary"
          />
        </form>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedType(cat.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer',
                selectedType === cat.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Communities Grid / List */}
      <div className="px-2 sm:px-0 space-y-2.5">
        {isLoading ? (
          <CommunityCardsSkeleton />
        ) : communities.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground space-y-2">
            <Compass className="h-10 w-10 mx-auto opacity-30 text-primary" />
            <p className="text-sm font-semibold">Không tìm thấy cộng đồng phù hợp</p>
            <p className="text-xs">Thử thay đổi từ khóa hoặc bộ lọc thể loại khác.</p>
          </div>
        ) : (
          communities.map((comm) => (
            <Card
              key={comm.id}
              className="border-0 bg-card rounded-xl shadow-none overflow-hidden ring-1 ring-transparent hover:ring-primary/25 transition-all duration-200"
            >
              <div className="relative h-24 w-full bg-muted overflow-hidden">
                {comm.bannerUrl ? (
                  <img
                    src={comm.bannerUrl}
                    alt={comm.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-primary/20 via-accent/20 to-background" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              </div>

              <CardContent className="p-4 sm:p-5 pt-0 relative">
                <div className="flex items-end justify-between -mt-8 sm:-mt-10 mb-3">
                  <div className="relative h-16 w-16 sm:h-18 sm:w-18 rounded-2xl overflow-hidden border-3 border-background bg-card shadow-md shrink-0">
                    {comm.avatarUrl ? (
                      <img
                        src={comm.avatarUrl}
                        alt={comm.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-xl">
                        {comm.slug.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <Button
                    variant={comm.isMember ? 'outline' : 'default'}
                    size="sm"
                    disabled={joiningSlug === comm.slug}
                    onClick={() => handleToggleJoin(comm.slug)}
                    className={cn(
                      'h-8 rounded-full px-4 text-xs font-semibold',
                      comm.isMember
                        ? 'border-border text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30'
                        : 'bg-primary text-primary-foreground'
                    )}
                  >
                    {joiningSlug === comm.slug ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : comm.isMember ? (
                      <span className="flex items-center gap-1">
                        <Check className="h-3 w-3 text-emerald-500" />
                        Đã tham gia
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <UserPlus className="h-3 w-3" />
                        Gia nhập
                      </span>
                    )}
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/c/${comm.slug}`}
                      onMouseEnter={() => prefetchCommunity(queryClient, comm.slug)}
                      className="font-semibold text-[15px] text-foreground hover:text-primary transition-colors line-clamp-1"
                    >
                      {comm.name}
                    </Link>
                    <Badge variant="secondary" className="text-[11px] font-medium bg-transparent px-0 text-muted-foreground">
                      c/{comm.slug}
                    </Badge>
                  </div>

                  <p className="text-[13px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {comm.description}
                  </p>

                  <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        <b className="text-foreground">{comm.membersCount}</b> thành viên
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5 text-primary" />
                        <b className="text-foreground">{comm.postsCount}</b> bài viết
                      </span>
                    </div>

                    <Link
                      href={`/c/${comm.slug}`}
                      onMouseEnter={() => prefetchCommunity(queryClient, comm.slug)}
                      className="text-primary font-semibold hover:underline flex items-center gap-1 text-xs"
                    >
                      Vào diễn đàn
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </>
  )
}
