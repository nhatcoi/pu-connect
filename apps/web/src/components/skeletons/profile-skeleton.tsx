import { LoadingRegion, Skeleton } from '@/components/ui/skeleton'
import { PostListSkeleton } from './feed-skeleton'

// Trang hồ sơ đang tải: thẻ đầu trang (banner, avatar, tên, giới thiệu) + tab + bài viết
export function ProfileSkeleton() {
  return (
    <LoadingRegion label="Đang tải hồ sơ">
      <div className="mx-2 sm:mx-0 mb-2.5 rounded-xl bg-card overflow-hidden">
        <Skeleton className="h-36 sm:h-44 w-full rounded-none" />
        <div className="px-4 sm:px-5 pb-5">
          <div className="flex justify-between items-end -mt-12 sm:-mt-14 mb-3">
            <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full border-4 border-card bg-card">
              <Skeleton className="h-full w-full rounded-full" />
            </div>
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-full mt-3" />
            <Skeleton className="h-3.5 w-3/5" />
            <div className="flex gap-4 pt-2">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3.5 w-20" />
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-6 px-4 sm:px-1 mb-2.5 h-11 items-center">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
      </div>
      <PostListSkeleton count={2} className="px-2 sm:px-0" />
    </LoadingRegion>
  )
}
