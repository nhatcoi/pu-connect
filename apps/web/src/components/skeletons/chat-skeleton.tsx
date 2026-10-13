import { cn } from '@/lib/utils'
import { LoadingRegion, Skeleton, SkeletonRepeat } from '@/components/ui/skeleton'

// Danh sách hội thoại: cùng khung ConversationItem (px-4 py-3, avatar 11)
export function ConversationListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <LoadingRegion label="Đang tải hội thoại" className="mx-2 sm:mx-0 rounded-xl bg-card overflow-hidden divide-y divide-border/50">
      <SkeletonRepeat count={count}>
        {(i) => (
          <div className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className={cn('h-3.5', i % 2 ? 'w-24' : 'w-36')} />
                <Skeleton className="ml-auto h-2.5 w-10" />
              </div>
              <Skeleton className={cn('h-3', i % 3 ? 'w-3/4' : 'w-1/2')} />
            </div>
          </div>
        )}
      </SkeletonRepeat>
    </LoadingRegion>
  )
}

// Bong bóng tin: [mine, chiều rộng, nối tiếp tin trước]
const BUBBLES: [boolean, string, boolean][] = [
  [false, 'w-48', false],
  [false, 'w-64', true],
  [true, 'w-40', false],
  [false, 'w-56', false],
  [true, 'w-60', false],
  [true, 'w-32', true]
]

// Khung chat đang tải: bong bóng xen kẽ hai phía, cùng lề với MessageBubble
export function MessageThreadSkeleton() {
  return (
    <LoadingRegion label="Đang tải tin nhắn" className="flex-1 px-3 sm:px-1 pt-2 pb-4">
      {BUBBLES.map(([mine, width, continued], i) => (
        <div key={i} className={cn('flex gap-2', mine ? 'flex-row-reverse' : 'flex-row', continued ? 'mt-0.5' : 'mt-3')}>
          {!mine && <div className="w-7 shrink-0 self-end">{!BUBBLES[i + 1]?.[2] && <Skeleton className="h-7 w-7 rounded-full" />}</div>}
          <Skeleton className={cn('h-9 max-w-[78%] rounded-2xl', width)} />
        </div>
      ))}
    </LoadingRegion>
  )
}

// Kho ảnh / tệp trong bảng thông tin
export function MediaPanelSkeleton({ kind }: { kind: 'image' | 'file' }) {
  return (
    <LoadingRegion label={kind === 'image' ? 'Đang tải ảnh' : 'Đang tải tệp'}>
      {kind === 'image' ? (
        <div className="grid grid-cols-3 gap-1 rounded-lg overflow-hidden">
          <SkeletonRepeat count={6}>{() => <Skeleton className="aspect-square rounded-none" />}</SkeletonRepeat>
        </div>
      ) : (
        <div className="space-y-1.5">
          <SkeletonRepeat count={3}>{() => <Skeleton className="h-[54px] w-full rounded-xl" />}</SkeletonRepeat>
        </div>
      )}
    </LoadingRegion>
  )
}
