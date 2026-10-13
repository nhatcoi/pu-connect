import { cn } from '@/lib/utils'
import { LoadingRegion, Skeleton, SkeletonRepeat } from '@/components/ui/skeleton'

// Danh sách thông báo: cùng khung NotificationRow (compact = popover)
export function NotificationListSkeleton({ count = 5, compact = false }: { count?: number; compact?: boolean }) {
  return (
    <LoadingRegion label="Đang tải thông báo">
      <SkeletonRepeat count={count}>
        {(i) => (
          <div className={cn('flex items-start gap-3', compact ? 'px-3 py-2.5' : 'px-4 py-3')}>
            <Skeleton className={cn('shrink-0 rounded-full', compact ? 'h-8 w-8' : 'h-10 w-10')} />
            <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
              <Skeleton className={cn('h-3', i % 2 ? 'w-3/4' : 'w-11/12')} />
              <Skeleton className={cn('h-3', i % 2 ? 'w-1/2' : 'w-2/3')} />
              <Skeleton className="h-2.5 w-14" />
            </div>
          </div>
        )}
      </SkeletonRepeat>
    </LoadingRegion>
  )
}
