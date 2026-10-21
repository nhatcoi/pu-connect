import React, { useState } from 'react'
import { FileSpreadsheet, X, Zap } from 'lucide-react'
import { toast } from 'sonner'
import type { AdminBotCommand, AdminBotOverview, BotCommandType } from '@pu/schemas'
import { adminApi, formatRelativeTime } from '@/lib/api'
import { Badge, Button, Card, CardHeader, EmptyState, List } from '@/components/ui'
import type { BotActionPreset } from './bot-action-dialog'
import { BotImportDialog } from './bot-import-dialog'
import { useBotMutation } from './use-bots'

const COMMAND_LABEL: Record<BotCommandType, string> = { post: 'Đăng bài', comment: 'Bình luận', like: 'Thả tim' }
const STATUS_TONE = { pending: 'neutral', running: 'primary', done: 'success', failed: 'danger', cancelled: 'neutral' } as const
const STATUS_LABEL = { pending: 'Chờ', running: 'Đang chạy', done: 'Xong', failed: 'Lỗi', cancelled: 'Đã hủy' } as const

function describe(c: AdminBotCommand): string {
  if (c.result) return c.result
  const p = c.payload as { bot?: string; content?: string; postId?: string; enhance?: string; source?: string }
  return [p.bot ? `@${p.bot}` : 'Bot ngẫu nhiên', p.source === 'import' && 'Excel', p.content?.slice(0, 60), p.postId && `bài ${p.postId.slice(0, 8)}…`, p.enhance === 'ai' && 'AI viết lại'].filter(Boolean).join(' · ')
}

export function BotScheduleCard({ data, onAct }: { data: AdminBotOverview; onAct: (preset: BotActionPreset) => void }) {
  const [importing, setImporting] = useState(false)
  const cancel = useBotMutation(
    (id: string) => adminApi.delete<AdminBotOverview>(`/admin/bots/commands/${id}`),
    () => toast.success('Đã hủy lệnh')
  )

  return (
    <>
      <Card>
        <CardHeader
          title="Lệnh điều hành & Lịch hẹn"
          description="Các lệnh đăng bài, bình luận, thả tim do Admin điều hành (chạy ngay hoặc hẹn giờ)."
          action={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setImporting(true)}>
                <FileSpreadsheet className="size-3.5" /> Import Excel
              </Button>
              <Button variant="primary" size="sm" onClick={() => onAct({})}>
                <Zap className="size-3.5" /> Điều hành Bot
              </Button>
            </div>
          }
        />
        {data.commands.length === 0 ? (
          <EmptyState
            title="Chưa có lệnh nào được tạo"
            description="Bấm 'Điều hành Bot' để yêu cầu bot đăng bài, bình luận hoặc thả tim."
          />
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
                  {c.status === 'pending' && new Date(c.scheduledAt).getTime() > Date.now()
                    ? `Hẹn ${new Date(c.scheduledAt).toLocaleString('vi-VN')}`
                    : `@${c.createdBy ?? 'admin'} · ${formatRelativeTime(c.createdAt)}`}
                </span>
                {c.status === 'pending' && (
                  <Button
                    size="icon-sm"
                    variant="danger-soft"
                    loading={cancel.isPending && cancel.variables === c.id}
                    onClick={() => cancel.mutate(c.id)}
                    title="Hủy lệnh"
                  >
                    <X />
                  </Button>
                )}
              </div>
            ))}
          </List>
        )}
      </Card>

      <BotImportDialog open={importing} onClose={() => setImporting(false)} />
    </>
  )
}
