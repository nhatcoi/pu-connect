import React, { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { toast } from 'sonner'
import type { AdminBotFeedItem, AdminBotOverview, AdminPage, BotFeedStatus } from '@pu/schemas'
import { adminApi, formatNumber, formatRelativeTime } from '@/lib/api'
import { Badge, Button, Card, CardHeader, EmptyState, LoadingRows, Tabs } from '@/components/ui'
import { BOTS_KEY, POLL_MS } from './use-bots'

const STATUS_LABEL: Record<BotFeedStatus, string> = { new: 'Chờ AI', review: 'Chờ duyệt', approved: 'Sẵn đăng', rejected: 'Từ chối', posted: 'Đã đăng', skipped: 'Bỏ qua' }
const TABS: BotFeedStatus[] = ['review', 'approved', 'new', 'rejected', 'posted']
const TONE = { new: 'neutral', review: 'warning', approved: 'primary', rejected: 'danger', posted: 'success', skipped: 'neutral' } as const

// Hàng đợi dữ liệu crawl: AI duyệt → (admin duyệt tay nếu bật) → bot đăng
export function FeedQueueCard({ overview }: { overview: AdminBotOverview }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState<BotFeedStatus>('review')
  const [page, setPage] = useState(1)
  const list = useQuery({
    queryKey: ['admin', 'bots', 'feed', status, page],
    queryFn: () => adminApi.get<AdminPage<AdminBotFeedItem>>(`/admin/bots/feed?status=${status}&page=${page}&pageSize=10`),
    placeholderData: keepPreviousData,
    refetchInterval: POLL_MS
  })
  const review = useMutation({
    mutationFn: (v: { id: string; action: 'approve' | 'reject' }) => adminApi.patch(`/admin/bots/feed/${v.id}`, { action: v.action }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: BOTS_KEY })
      void qc.invalidateQueries({ queryKey: ['admin', 'bots', 'feed'] })
    },
    onError: (e: Error) => toast.error(e.message)
  })
  const rows = list.data?.items ?? []
  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / 10))

  return (
    <Card>
      <CardHeader
        title="Dữ liệu crawl"
        description={`Đăng 24 giờ qua: ${formatNumber(overview.feed.posted24h)} · lần cuối ${formatRelativeTime(overview.feed.lastPostedAt)}`}
      />
      <div className="px-4">
        <Tabs
          value={status}
          onChange={(s) => {
            setStatus(s)
            setPage(1)
          }}
          items={TABS.map((s) => ({ id: s, label: `${STATUS_LABEL[s]} (${formatNumber(overview.feed.byStatus[s])})` }))}
        />
      </div>
      {list.isPending ? (
        <LoadingRows rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState title="Trống" description="Chạy tools/fb-group-digest để đẩy dữ liệu lên." />
      ) : (
        <div className="divide-y divide-border border-t border-border">
          {rows.map((it) => (
            <div key={it.id} className="space-y-1.5 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={TONE[it.status]}>{STATUS_LABEL[it.status]}</Badge>
                {it.topic && <Badge tone="primary">{it.topic}</Badge>}
                {it.imageCount > 0 && <Badge>{it.imageCount} ảnh</Badge>}
                {it.postedBy && <span className="text-xs text-muted-foreground">@{it.postedBy}</span>}
                <span className="ml-auto text-xs text-muted-foreground">{formatRelativeTime(it.postedAt ?? it.createdAt)}</span>
              </div>
              <p className="line-clamp-4 whitespace-pre-line break-words text-foreground">{it.content}</p>
              {it.verdict?.reason && (
                <p className="text-xs text-muted-foreground">
                  AI{it.verdict.model ? ` (${it.verdict.model})` : ''}: {it.verdict.reason}
                </p>
              )}
              {(it.status === 'review' || it.status === 'rejected' || it.status === 'new') && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="primary" loading={review.isPending && review.variables?.id === it.id && review.variables.action === 'approve'} onClick={() => review.mutate({ id: it.id, action: 'approve' })}>
                    <Check /> Duyệt đăng
                  </Button>
                  {it.status !== 'rejected' && (
                    <Button size="sm" variant="danger-soft" onClick={() => review.mutate({ id: it.id, action: 'reject' })}>
                      <X /> Từ chối
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-sm">
          <span className="tabular-nums text-muted-foreground">
            Trang {page}/{totalPages}
          </span>
          <div className="flex gap-2">
            <Button size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Trước
            </Button>
            <Button size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Sau
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
