import { cn } from '@/lib/utils'
import { LoadingRegion, Skeleton, SkeletonRepeat } from '@/components/ui/skeleton'
import { PostCardSkeleton } from './post-card-skeleton'

// Danh sách thẻ bài giữ chỗ (không tự báo trạng thái — dùng trong LoadingRegion khác)
export function PostListSkeleton({ count = 3, variant = 'card', className }: { count?: number; variant?: 'flat' | 'card'; className?: string }) {
  return (
    <div className={cn(variant === 'card' && 'space-y-2.5', className)}>
      <SkeletonRepeat count={count}>{(i) => <PostCardSkeleton variant={variant} index={i} />}</SkeletonRepeat>
    </div>
  )
}

// Bảng tin đang tải (bảng tin, cộng đồng, hồ sơ)
export function FeedSkeleton({
  label = 'Đang tải bài viết',
  className,
  ...list
}: {
  count?: number
  variant?: 'flat' | 'card'
  label?: string
  className?: string
}) {
  return (
    <LoadingRegion label={label} className={className}>
      <PostListSkeleton {...list} />
    </LoadingRegion>
  )
}

// Đầu trang cộng đồng: banner + avatar + tên + mô tả + tab (cùng khung với thẻ thật)
export function CommunityHeaderSkeleton() {
  return (
    <div className="mx-2 sm:mx-0 mb-2.5 rounded-xl bg-card overflow-hidden">
      <Skeleton className="h-36 sm:h-44 w-full rounded-none" />
      <div className="px-4 sm:px-5 pb-4">
        <div className="flex items-end justify-between -mt-12 sm:-mt-14 mb-3">
          <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl border-4 border-card bg-card">
            <Skeleton className="h-full w-full rounded-xl" />
          </div>
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
        <div className="flex gap-2 mt-4">
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      </div>
    </div>
  )
}
