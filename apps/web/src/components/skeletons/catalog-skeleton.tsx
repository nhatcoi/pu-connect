import { cn } from '@/lib/utils'
import { LoadingRegion, Skeleton, SkeletonRepeat } from '@/components/ui/skeleton'

// Lưới thẻ cộng đồng (/communities): banner + avatar vuông bo góc + tên + mô tả
export function CommunityCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <LoadingRegion label="Đang tải cộng đồng" className="space-y-2.5">
      <SkeletonRepeat count={count}>
        {() => (
          <div className="bg-card rounded-xl overflow-hidden">
            <Skeleton className="h-24 w-full rounded-none" />
            <div className="p-4 sm:p-5 pt-0">
              <div className="flex items-end justify-between -mt-8 sm:-mt-10 mb-3">
                <div className="h-16 w-16 sm:h-18 sm:w-18 rounded-2xl border-3 border-background bg-card">
                  <Skeleton className="h-full w-full rounded-xl" />
                </div>
                <Skeleton className="h-8 w-24 rounded-full" />
              </div>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-full mt-2.5" />
              <Skeleton className="h-3 w-2/3 mt-1.5" />
            </div>
          </div>
        )}
      </SkeletonRepeat>
    </LoadingRegion>
  )
}

// Danh sách học phần (/courses): mã + tín chỉ, tên, số tài liệu/thảo luận
export function CourseListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <LoadingRegion label="Đang tải học phần" className="px-2 sm:px-0 space-y-2">
      <SkeletonRepeat count={count}>
        {(i) => (
          <div className="rounded-xl bg-card px-4 py-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-14" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className={cn('h-4 mt-2', i % 2 ? 'w-1/2' : 'w-2/3')} />
            <div className="flex gap-3 mt-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        )}
      </SkeletonRepeat>
    </LoadingRegion>
  )
}

// Thẻ đầu trang học phần: mã, tên, mô tả, 4 ô thống kê, tab
export function CourseHeaderSkeleton() {
  return (
    <div className="mx-2 sm:mx-0 mb-2.5 rounded-xl bg-card p-4 sm:p-5 space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-6 w-3/5" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-4/5" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <SkeletonRepeat count={4}>{() => <Skeleton className="h-14 rounded-lg" />}</SkeletonRepeat>
      </div>
      <div className="flex gap-6 h-9 items-center">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  )
}

// Thẻ chung (tài liệu, nhóm học, hàng quản trị): icon + 2 dòng + chân thẻ
export function CardListSkeleton({ count = 3, label = 'Đang tải', className }: { count?: number; label?: string; className?: string }) {
  return (
    <LoadingRegion label={label} className={cn('space-y-2.5', className)}>
      <SkeletonRepeat count={count}>
        {(i) => (
          <div className="rounded-xl bg-card border border-border/60 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className={cn('h-3.5', i % 2 ? 'w-1/2' : 'w-3/5')} />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
            <Skeleton className="h-3 w-full" />
            <div className="flex justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-20 rounded-full" />
            </div>
          </div>
        )}
      </SkeletonRepeat>
    </LoadingRegion>
  )
}

// Danh sách cài đặt (nhãn + công tắc)
export function SettingsListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <LoadingRegion label="Đang tải cài đặt" className="space-y-4">
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="space-y-3">
        <SkeletonRepeat count={count}>
          {() => (
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-52 max-w-full" />
              </div>
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
          )}
        </SkeletonRepeat>
      </div>
    </LoadingRegion>
  )
}
