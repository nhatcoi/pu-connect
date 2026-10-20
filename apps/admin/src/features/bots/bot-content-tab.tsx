import React from 'react'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import type { AdminBotCommand, AdminBotOverview, BotCommandType } from '@pu/schemas'
import { adminApi, formatRelativeTime } from '@/lib/api'
import { Badge, Button, Card, CardHeader, EmptyState, List } from '@/components/ui'
import type { BotActionPreset } from './bot-action-dialog'
import { FeedQueueCard } from './feed-queue-card'
import { useBotMutation } from './use-bots'

const COMMAND_LABEL: Record<BotCommandType, string> = { post: 'Đăng bài', comment: 'Bình luận', like: 'Thả tim' }
const STATUS_TONE = { pending: 'neutral', running: 'primary', done: 'success', failed: 'danger', cancelled: 'neutral' } as const
const STATUS_LABEL = { pending: 'Chờ', running: 'Đang chạy', done: 'Xong', failed: 'Lỗi', cancelled: 'Đã hủy' } as const

function describe(c: AdminBotCommand): string {
  if (c.result && (c.status === 'failed' || c.status === 'cancelled')) return c.result
  const p = c.payload as { bot?: string; content?: string; postId?: string; feedItemId?: string; enhance?: string }
  return [p.bot ? `@${p.bot}` : 'Bot ngẫu nhiên', p.feedItemId && `bài crawl #${p.feedItemId}`, p.content?.slice(0, 60), p.postId && `bài ${p.postId.slice(0, 8)}…`, p.enhance === 'ai' && 'AI viết lại'].filter(Boolean).join(' · ')
}

// Kho nội dung (dữ liệu crawl) + hàng đợi hành động giao cho bot (ngay/hẹn giờ)
export function BotContentTab({ data, onAct }: { data: AdminBotOverview; onAct: (preset: BotActionPreset) => void }) {
  const cancel = useBotMutation(
    (id: string) => adminApi.delete<AdminBotOverview>(`/admin/bots/commands/${id}`),
    () => toast.success('Đã hủy lệnh')
  )

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Hàng đợi hành động"
          description="Việc admin giao cho bot: chạy ngay hoặc theo giờ hẹn. Lệnh đang chờ hủy được."
          action={
            <Button variant="primary" onClick={() => onAct({})}>
              <Plus /> Giao việc
            </Button>
          }
        />
        {data.commands.length === 0 ? (
          <EmptyState title="Chưa có lệnh" description="Bấm Giao việc để bắt bot đăng bài, bình luận hoặc thả tim." />
        ) : (
          <List className="rounded-none border-x-0 border-b-0">
            {data.commands.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{COMMAND_LABEL[c.type]}</p>
                  <p className="truncate text-xs text-muted-foreground">{describe(c)}</p>
                </div>
                <span className="shrink-0 text-right text-xs text-muted-foreground">
                  {c.status === 'pending' && new Date(c.scheduledAt).getTime() > Date.now() ? `Hẹn ${new Date(c.scheduledAt).toLocaleString('vi-VN')}` : `@${c.createdBy ?? '?'} · ${formatRelativeTime(c.createdAt)}`}
                </span>
                {c.status === 'pending' && (
                  <Button size="icon-sm" variant="danger-soft" loading={cancel.isPending && cancel.variables === c.id} onClick={() => cancel.mutate(c.id)} title="Hủy lệnh">
                    <X />
                  </Button>
                )}
              </div>
            ))}
          </List>
        )}
      </Card>

      <FeedQueueCard overview={data} onAssign={(item) => onAct({ type: 'post', feedItem: item })} />
    </div>
  )
}
