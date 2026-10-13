import { LoadingRegion, Skeleton, SkeletonRepeat } from '@/components/ui/skeleton'

// Bình luận đang tải: cùng khung CommentItemCard (p-3, avatar 7)
export function CommentListSkeleton({ count = 2 }: { count?: number }) {
  return (
    <LoadingRegion label="Đang tải bình luận" className="space-y-3">
      <SkeletonRepeat count={count}>
        {(i) => (
          <div className="rounded-xl border border-transparent p-3 space-y-2">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2.5 w-12" />
            </div>
            <div className="space-y-1.5 pl-9">
              <Skeleton className="h-3 w-full" />
              <Skeleton className={i % 2 ? 'h-3 w-1/2' : 'h-3 w-4/5'} />
            </div>
          </div>
        )}
      </SkeletonRepeat>
    </LoadingRegion>
  )
}
