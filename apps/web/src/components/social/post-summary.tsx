'use client'

import React from 'react'
import { Sparkles } from 'lucide-react'
import { MarkdownPreview } from '@/components/renderer/markdown-preview'
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton'
import { usePostSummary } from '@/hooks/use-post-summary'

// Khung tóm tắt N7AI dưới nội dung bài (mở bằng nút "Tóm tắt")
export function PostSummary({ postId }: { postId: string }) {
  const { data, error, isPending, refetch, isFetching } = usePostSummary(postId, true)

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 space-y-1.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
        <Sparkles className="h-3.5 w-3.5" /> Tóm tắt bởi N7AI
      </p>
      {isPending ? (
        <LoadingRegion label="N7AI đang tóm tắt" className="space-y-1.5 py-0.5">
          <Skeleton className="h-3 w-11/12" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-2/3" />
        </LoadingRegion>
      ) : error ? (
        <p className="text-xs text-muted-foreground">
          {error.message || 'Không tóm tắt được bài này.'}{' '}
          <button type="button" className="text-primary hover:underline cursor-pointer" disabled={isFetching} onClick={() => refetch()}>
            Thử lại
          </button>
        </p>
      ) : (
        <>
          <MarkdownPreview content={data.summary} className="text-xs leading-relaxed" />
          <p className="text-[10px] text-muted-foreground">Tóm tắt tự động, có thể chưa chính xác — đọc bài gốc để chắc chắn.</p>
        </>
      )}
    </div>
  )
}
