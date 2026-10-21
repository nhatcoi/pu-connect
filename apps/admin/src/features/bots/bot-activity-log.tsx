import React, { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Bot } from 'lucide-react'
import type { AdminBotActivity, AdminPage } from '@pu/schemas'
import { adminApi, cn, formatRelativeTime } from '@/lib/api'
import { Badge, Button, Card, CardHeader, EmptyState, List, LoadingRows, Select } from '@/components/ui'
import { POLL_MS } from './use-bots'

// Nhật ký hoạt động của bot (giữ 7 ngày)
export function BotActivityLog({ bots }: { bots: string[] }) {
  const [page, setPage] = useState(1)
  const [bot, setBot] = useState('')
  const [level, setLevel] = useState('')
  const qs = new URLSearchParams({ page: String(page), pageSize: '20', ...(bot && { bot }), ...(level && { level }) }).toString()
  const log = useQuery({
    queryKey: ['admin', 'bots', 'activity', qs],
    queryFn: () => adminApi.get<AdminPage<AdminBotActivity>>(`/admin/bots/activity?${qs}`),
    placeholderData: keepPreviousData,
    refetchInterval: POLL_MS
  })
  const rows = log.data?.items ?? []
  const totalPages = Math.max(1, Math.ceil((log.data?.total ?? 0) / 20))
  const reset = (fn: () => void) => () => {
    fn()
    setPage(1)
  }

  return (
    <Card>
      <CardHeader
        title="Nhật ký hoạt động"
        action={
          <div className="flex gap-2">
            <Select value={bot} onChange={(e) => reset(() => setBot(e.target.value))()} className="w-40">
              <option value="">Mọi bot</option>
              {bots.map((b) => (
                <option key={b} value={b}>
                  @{b}
                </option>
              ))}
            </Select>
            <Select value={level} onChange={(e) => reset(() => setLevel(e.target.value))()} className="w-32">
              <option value="">Mọi mức</option>
              <option value="warn">Cảnh báo</option>
              <option value="error">Lỗi</option>
            </Select>
          </div>
        }
      />
      {log.isPending ? (
        <LoadingRows rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Bot} title="Chưa có hoạt động" />
      ) : (
        <>
          <List className={cn('rounded-none border-x-0 border-b-0', log.isPlaceholderData && 'opacity-60')}>
            {rows.map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                <Badge tone={a.level === 'error' ? 'danger' : a.level === 'warn' ? 'warning' : 'neutral'}>{a.action}</Badge>
                <p className="min-w-0 flex-1 break-words text-foreground">
                  {a.botUsername && <span className="mr-1.5 font-medium text-muted-foreground">@{a.botUsername}</span>}
                  {a.details}
                </p>
                <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(a.createdAt)}</span>
              </div>
            ))}
          </List>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-sm">
              <span className="text-muted-foreground tabular-nums">
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
        </>
      )}
    </Card>
  )
}
