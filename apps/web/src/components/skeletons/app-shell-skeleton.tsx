import {
  LoadingRegion,
  Skeleton,
  SkeletonRepeat,
} from "@/components/ui/skeleton";
import { PuMark } from "@/components/brand/pu-logo";
import { PostCardSkeleton } from "./post-card-skeleton";

// Khung 3 cột khi đang xác thực phiên: cùng hình học với AppLayout ⇒ vào app không bị nhảy
export function AppShellSkeleton() {
  return (
    <div className="min-h-screen bg-surface">
      <LoadingRegion label="Đang tải PU Connector">
        <div className="w-full bg-background/95 shadow-[0_1px_0_0_rgb(0_0_0/0.04)]">
          <div className="mx-auto flex h-13 md:h-14 max-w-7xl items-center justify-between px-3.5 sm:px-6">
            <div className="flex items-center gap-2.5">
              <PuMark className="h-8 w-8 md:h-9 md:w-9" />
              <Skeleton className="hidden md:block h-4 w-28" />
            </div>
            <Skeleton className="hidden md:block h-9 w-80 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
        <div className="mx-auto flex justify-center gap-6 max-w-7xl px-0 sm:px-4 lg:px-6">
          <div className="hidden md:flex shrink-0 w-14 xl:w-56 flex-col gap-2 py-3">
            <SkeletonRepeat count={6}>
              {() => (
                <div className="flex items-center gap-3 px-3 py-2">
                  <Skeleton className="h-6 w-6 rounded-md" />
                  <Skeleton className="hidden xl:block h-4 w-24" />
                </div>
              )}
            </SkeletonRepeat>
          </div>
          <main className="flex-1 max-w-[640px] w-full min-w-0 space-y-3 py-3 sm:py-4">
            <SkeletonRepeat count={3}>
              {(i) => <PostCardSkeleton variant="card" index={i} />}
            </SkeletonRepeat>
          </main>
          <aside className="hidden lg:block w-64 xl:w-72 shrink-0 py-4 space-y-3">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </aside>
        </div>
      </LoadingRegion>
    </div>
  );
}
