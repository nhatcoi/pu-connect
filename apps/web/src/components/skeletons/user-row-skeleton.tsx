import { cn } from '@/lib/utils'
import { LoadingRegion, Skeleton, SkeletonRepeat } from '@/components/ui/skeleton'

// Hàng người dùng: avatar + tên + @username (+ nút) — gợi ý theo dõi, thành viên, danh sách follow
export function UserRowSkeleton({ avatarClassName = 'h-8 w-8', action = false, className }: { avatarClassName?: string; action?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5 px-2 py-1.5', className)}>
      <Skeleton className={cn('shrink-0 rounded-full', avatarClassName)} />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-3 w-28 max-w-full" />
        <Skeleton className="h-2.5 w-20 max-w-full" />
      </div>
      {action && <Skeleton className="h-7 w-16 rounded-full shrink-0" />}
    </div>
  )
}

export function UserListSkeleton({
  count = 3,
  label = 'Đang tải danh sách',
  className,
  ...row
}: {
  count?: number
  label?: string
  className?: string
  avatarClassName?: string
  action?: boolean
}) {
  return (
    <LoadingRegion label={label} className={className}>
      <SkeletonRepeat count={count}>{() => <UserRowSkeleton {...row} />}</SkeletonRepeat>
    </LoadingRegion>
  )
}
