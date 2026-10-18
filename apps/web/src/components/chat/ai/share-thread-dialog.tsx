'use client'

import React from 'react'
import { Check, Copy, ExternalLink, Link2, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useAiThreadShare } from '@/hooks/chat'
import { n7aiShareHref } from '@/lib/n7ai-routes'
import { formatRelativeTime } from '@/lib/utils'

interface ShareThreadDialogProps {
  threadId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Chia sẻ hội thoại N7AI: tạo link công khai (ảnh chụp tới tin cuối), sao chép, cập nhật, ngắt
export function ShareThreadDialog({ threadId, open, onOpenChange }: ShareThreadDialogProps) {
  const { data: share, isPending, share: create, unshare } = useAiThreadShare(threadId, open)
  const [copied, setCopied] = React.useState(false)
  const url = share ? `${window.location.origin}${n7aiShareHref(share.token)}` : ''

  const copy = async (link = url) => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      toast.success('Đã sao chép link')
    } catch {
      toast.error('Không sao chép được, hãy chép thủ công')
    }
  }
  // Tạo link lần đầu ⇒ sao chép luôn
  const createAndCopy = () => create.mutate(undefined, { onSuccess: (s) => void copy(`${window.location.origin}${n7aiShareHref(s.token)}`) })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-5 gap-4">
        <DialogHeader>
          <DialogTitle className="text-base">Chia sẻ cuộc trò chuyện</DialogTitle>
          <DialogDescription className="text-xs">
            Ai có link đều xem được nội dung tới thời điểm chia sẻ, không cần đăng nhập. Tệp đính kèm và nguồn riêng tư (Drive, Lịch, tài liệu) không hiện;
            nội dung câu trả lời thì hiện nguyên văn.
          </DialogDescription>
        </DialogHeader>

        {isPending ? (
          <Skeleton className="h-10 rounded-xl" />
        ) : !share ? (
          <Button className="h-10 rounded-full gap-2" disabled={create.isPending} onClick={createAndCopy}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Tạo link công khai
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 p-1.5 pl-3">
              <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 bg-transparent text-xs outline-none" aria-label="Link chia sẻ" />
              <Button size="sm" className="h-8 rounded-full gap-1.5 shrink-0" onClick={() => void copy()}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Sao chép
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {share.messageCount} tin · chụp lúc {formatRelativeTime(share.sharedAt).toLowerCase()}
              {share.hasNewer && ' · có tin mới chưa nằm trong link'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {share.hasNewer && (
                <Button size="sm" variant="outline" className="h-8 rounded-full gap-1.5 text-xs" disabled={create.isPending} onClick={() => create.mutate()}>
                  {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Cập nhật link
                </Button>
              )}
              <Button asChild size="sm" variant="ghost" className="h-8 rounded-full gap-1.5 text-xs">
                <a href={n7aiShareHref(share.token)} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" /> Xem trang
                </a>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto h-8 rounded-full text-xs text-destructive"
                disabled={unshare.isPending}
                onClick={() => unshare.mutate()}
              >
                Ngắt chia sẻ
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
