import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// Giữ chỗ PostCard: cùng padding/khung theo variant, độ dài dòng thay đổi cho tự nhiên
const LINE_WIDTHS = [
  ["w-full", "w-11/12", "w-2/3"],
  ["w-full", "w-4/5"],
  ["w-full", "w-full", "w-3/4", "w-1/2"],
];

export function PostCardSkeleton({
  variant = "flat",
  index = 0,
}: {
  variant?: "flat" | "card";
  index?: number;
}) {
  const lines = LINE_WIDTHS[index % LINE_WIDTHS.length];
  return (
    <div
      className={cn(
        variant === "card"
          ? "rounded-xl bg-card px-4 py-3.5 sm:px-5"
          : "px-4 py-3.5 sm:px-5 sm:py-4 border-b border-border/40 bg-background",
      )}
    >
      <div className="flex gap-3">
        <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
        <div className="flex-1 min-w-0 space-y-2.5">
          <div className="flex items-center gap-2 pt-0.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="space-y-2 pt-1">
            {lines.map((w, i) => (
              <Skeleton key={i} className={cn("h-3.5", w)} />
            ))}
          </div>
          <div className="flex items-center justify-between pt-2 max-w-sm">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-6" />
          </div>
        </div>
      </div>
    </div>
  );
}
