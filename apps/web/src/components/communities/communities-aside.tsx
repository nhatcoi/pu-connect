'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Compass, ShieldCheck } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { Community } from '@pu/schemas'
import { Skeleton } from '@/components/ui/skeleton'

export function CommunitiesAside() {
  const { data: communities = [], isPending } = useQuery({
    queryKey: queryKeys.communities,
    queryFn: async () => {
      const res = await apiClient<{ success: boolean; data: Community[] }>('/communities')
      return res.data
    },
    staleTime: 2 * 60 * 1000
  })

  // Cộng đồng sinh viên đã tham gia
  const myCommunities = useMemo(() => communities.filter((c) => c.isMember), [communities])

  // Top cộng đồng nổi bật
  const topCommunities = useMemo(() => {
    return communities
      .slice()
      .sort((a, b) => (b.membersCount ?? 0) - (a.membersCount ?? 0))
      .slice(0, 4)
  }, [communities])

  return (
    <div className="w-full space-y-5">
      {/* 1. Cộng đồng của bạn (nếu đã tham gia) */}
      {myCommunities.length > 0 && (
        <section className="space-y-2">
          <h3 className="px-1 text-[13px] font-semibold text-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Cộng đồng của bạn</span>
          </h3>
          <div className="space-y-1">
            {myCommunities.map((c) => (
              <Link
                key={c.slug}
                href={`/c/${c.slug}`}
                className="group flex items-center justify-between rounded-xl px-3 py-2 hover:bg-muted/70 transition-colors border border-transparent hover:border-border/60"
              >
                <div className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {c.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground">c/{c.slug}</span>
                </div>
                <span className="text-[11px] font-medium text-muted-foreground/80 shrink-0">
                  {c.membersCount} TV
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 2. Cộng đồng sôi nổi Phenikaa */}
      <section className="space-y-2">
        <h3 className="px-1 text-[13px] font-semibold text-foreground flex items-center gap-1.5">
          <Compass className="h-4 w-4 text-primary" />
          <span>Cộng đồng nổi bật</span>
        </h3>
        {isPending ? (
          <div className="space-y-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {topCommunities.map((c) => (
              <Link
                key={c.slug}
                href={`/c/${c.slug}`}
                className="group flex flex-col rounded-xl px-3 py-2 hover:bg-muted/70 transition-colors border border-transparent hover:border-border/60"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground group-hover:text-primary group-hover:underline truncate">
                    {c.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{c.membersCount} TV</span>
                </div>
                {c.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{c.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 3. Tiêu chuẩn văn hóa Phenikaa */}
      <section className="space-y-2">
        <h3 className="px-1 text-[13px] font-semibold text-foreground flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span>Văn hóa học đường</span>
        </h3>
        <div className="rounded-xl border border-border/60 bg-card p-3 space-y-2 text-xs text-muted-foreground leading-relaxed">
          <p>
            Cộng đồng PU Connect là không gian học thuật văn minh của sinh viên và giảng viên Trường Đại học Phenikaa.
          </p>
          <ul className="list-disc pl-4 space-y-1 text-[11px]">
            <li>Tôn trọng người khác & thảo luận mang tính xây dựng.</li>
            <li>Chia sẻ tài liệu chính xác, trung thực.</li>
            <li>Nghiêm cấm ngôn từ kích động, gian lận học vụ.</li>
          </ul>
        </div>
      </section>

      {/* 4. Minimal Footer */}
      <div className="px-2 text-[11px] text-muted-foreground/70 space-y-1 pt-1">
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          <Link href="/terms" prefetch={false} className="hover:underline">
            Điều khoản
          </Link>
          <span>·</span>
          <Link href="/privacy-policy" prefetch={false} className="hover:underline">
            Quyền riêng tư
          </Link>
          <span>·</span>
          <Link href="/search" prefetch={false} className="hover:underline">
            Trợ giúp
          </Link>
        </div>
        <div className="flex items-center gap-1.5 pt-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>PU Connect © 2026 Phenikaa</span>
        </div>
      </div>
    </div>
  )
}
