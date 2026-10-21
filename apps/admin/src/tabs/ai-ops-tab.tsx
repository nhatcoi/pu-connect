import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, CheckCircle2, EyeOff, LifeBuoy, Power, Sparkles, ThumbsDown, ThumbsUp, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { AdminAiOverview, AdminAiSkillRow, AdminPermission, AiFeedbackStats } from '@pu/schemas'
import { adminApi, cn, formatCompact, formatNumber, formatRelativeTime } from '@/lib/api'
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  List,
  LoadingRows,
  Menu,
  MenuItem,
  PageHeader,
  Skeleton,
  Stat,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tabs,
  Tr,
  Button,
  Segmented,
  SortTh
} from '@/components/ui'
import { ListFooter, ListSearch, useListState, usePaged } from '@/components/list/list-kit'
import { SavedViews } from '@/components/list/saved-views'
import { useHashQuery } from '@/hooks/use-hash-query'
import { LlmSection } from '@/features/llm/llm-section'

const REASON_LABEL: Record<string, string> = {
  wrong: 'Sai kiến thức',
  unhelpful: 'Chưa hữu ích',
  unsafe: 'Không phù hợp',
  too_long: 'Dài dòng',
  other: 'Khác'
}

const TICKET_TONE = { open: 'warning', resolved: 'success', closed: 'neutral' } as const
const TICKET_LABEL = { open: 'Đang mở', resolved: 'Đã xử lý', closed: 'Đã đóng' } as const

function useAiMutation<V>(fn: (v: V) => Promise<unknown>, msg: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(msg)
      void qc.invalidateQueries({ queryKey: ['admin'] })
    },
    onError: (err: Error) => toast.error(err.message)
  })
}

export function AiOpsTab({ permissions, openTickets }: { permissions: AdminPermission[]; openTickets?: number }) {
  const [params, set] = useHashQuery()
  const tab = (['usage', 'feedback', 'skills', 'llm'].includes(params.tab) ? params.tab : 'usage') as 'usage' | 'feedback' | 'skills' | 'llm'
  const canManage = permissions.includes('ai:manage')

  return (
    <>
      <PageHeader
        title="N7AI"
        actions={<SavedViews page="ai" />}
        tabs={
          <Tabs
            value={tab}
            onChange={(t) => set({ tab: t === 'usage' ? undefined : t }, { replace: true })}
            items={[
              { id: 'usage', label: 'Sử dụng' },
              { id: 'feedback', label: 'Phản hồi & hỗ trợ', count: openTickets },
              { id: 'skills', label: 'Skills' },
              { id: 'llm', label: 'Mô hình & Dịch vụ' }
            ]}
          />
        }
      />
      {tab === 'usage' && <UsageSection />}
      {tab === 'feedback' && <FeedbackSection canManage={canManage} />}
      {tab === 'skills' && <SkillsSection canManage={canManage} />}
      {tab === 'llm' && <LlmSection canManage={canManage} />}
    </>
  )
}

function UsageSection() {
  const { data: d, isPending, isError, error } = useQuery({
    queryKey: ['admin', 'ai', 'overview'],
    queryFn: () => adminApi.get<AdminAiOverview>('/admin/ai/overview')
  })

  if (isPending) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[106px] rounded-xl" />
        ))}
      </div>
    )
  }
  if (isError || !d) return <ErrorState message={(error as Error)?.message || 'Không tải được dữ liệu'} />

  const maxRuns = Math.max(1, ...d.dailySeries.map((x) => x.runs))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Lượt chạy 24h" value={formatNumber(d.runs24h)} sub={`${formatNumber(d.runs7d)} trong 7 ngày`} />
        <Stat
          label="Tokens 24h"
          value={formatCompact(d.inputTokens24h + d.outputTokens24h)}
          sub={`${formatCompact(d.inputTokens24h)} vào · ${formatCompact(d.outputTokens24h)} ra`}
        />
        <Stat label="Độ trễ TB" value={`${(d.avgLatencyMs24h / 1000).toFixed(1)}s`} sub="24 giờ qua" />
        <Stat label="Lỗi 24h" value={formatNumber(d.errorRuns24h)} tone={d.errorRuns24h > 0 ? 'danger' : undefined} sub={`${d.activeTasksCount} tác vụ hẹn giờ`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Biểu đồ cột 7 ngày */}
        <Card className="lg:col-span-3">
          <CardHeader title="Lượt chạy 7 ngày" />
          <div className="flex h-48 items-end gap-2 px-5 pb-4">
            {d.dailySeries.map((day) => (
              <div key={day.date} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-[11px] font-medium tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  {day.runs}
                </span>
                <div className="flex min-h-0 w-full flex-1 items-end justify-center">
                  <div
                    title={`${day.runs} lượt · ${formatNumber(day.tokens)} tokens${day.errors ? ` · ${day.errors} lỗi` : ''}`}
                    className="relative w-full max-w-10 overflow-hidden rounded-t-md bg-primary/80 transition-colors group-hover:bg-primary"
                    style={{ height: `${Math.max(2, (day.runs / maxRuns) * 100)}%` }}
                  >
                    {day.errors > 0 && (
                      <div className="absolute inset-x-0 bottom-0 bg-red-500" style={{ height: `${(day.errors / Math.max(1, day.runs)) * 100}%` }} />
                    )}
                  </div>
                </div>
                <span className="text-[11px] tabular-nums text-muted-foreground">{day.date.slice(8)}/{day.date.slice(5, 7)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Người dùng nhiều nhất" description="7 ngày" />
          {d.topUsers7d.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">Chưa có dữ liệu</p>
          ) : (
            <ol className="px-5 pb-3">
              {d.topUsers7d.slice(0, 6).map((u, i) => (
                <li key={u.userId} className="flex items-center gap-3 py-1.5 text-sm">
                  <span className="w-4 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 truncate text-foreground">@{u.username}</span>
                  <span className="tabular-nums text-muted-foreground">{u.runs} lượt</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Table>
        <THead>
          <Th>Tác vụ (7 ngày)</Th>
          <Th className="text-right">Lượt</Th>
          <Th className="text-right">Độ trễ TB</Th>
          <Th className="text-right">Lỗi</Th>
        </THead>
        <TBody>
          {d.byTask.map((t) => (
            <Tr key={t.task}>
              <Td className="font-mono text-xs">{t.task}</Td>
              <Td className="text-right tabular-nums">{formatNumber(t.count)}</Td>
              <Td className="text-right tabular-nums text-muted-foreground">{(t.avgLatencyMs / 1000).toFixed(1)}s</Td>
              <Td className={cn('text-right tabular-nums', t.errors > 0 ? 'font-semibold text-danger' : 'text-muted-foreground')}>{t.errors}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>

      <Card>
        <CardHeader title="Lỗi gần đây" />
        {d.recentErrors.length === 0 ? (
          <p className="flex items-center gap-2 px-5 pb-5 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-success" /> Không có lỗi
          </p>
        ) : (
          <div className="divide-y divide-border border-t border-border">
            {d.recentErrors.map((err) => (
              <div key={err.id} className="space-y-1.5 px-5 py-3">
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <Badge tone="danger" className="font-mono">
                    {err.task}
                  </Badge>
                  <span className="font-mono">{err.model || 'default'}</span>
                  <span>· @{err.requesterUsername || 'unknown'}</span>
                  <span className="ml-auto">{formatRelativeTime(err.createdAt)}</span>
                </div>
                <p className="break-all font-mono text-xs text-foreground/80">{err.error || 'Unknown error'}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function FeedbackSection({ canManage }: { canManage: boolean }) {
  const { data: s, isPending, isError, error } = useQuery({
    queryKey: ['admin', 'ai-feedback'],
    queryFn: () => adminApi.get<AiFeedbackStats>('/admin/ai-feedback')
  })
  const update = useAiMutation(
    ({ id, status }: { id: string; status: 'open' | 'resolved' | 'closed' }) => adminApi.patch(`/admin/ai/tickets/${id}`, { status }),
    'Đã cập nhật yêu cầu'
  )

  if (isPending) return <LoadingRows rows={4} />
  if (isError || !s) return <ErrorState message={(error as Error)?.message || 'Không tải được dữ liệu'} />

  const total = s.up + s.down
  const reasons = Object.entries(s.byReason).sort((a, b) => b[1] - a[1])
  const maxReason = Math.max(1, ...reasons.map(([, n]) => n))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-medium text-muted-foreground">Hài lòng · 30 ngày</p>
          <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-foreground">{total ? Math.round((s.up / total) * 100) : 100}%</p>
          <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-red-500/70">
            <div className="h-full bg-green-500" style={{ width: `${total ? (s.up / total) * 100 : 100}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <ThumbsUp className="size-3.5" /> {s.up}
            </span>
            <span className="inline-flex items-center gap-1">
              <ThumbsDown className="size-3.5" /> {s.down}
            </span>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Lý do đánh giá thấp" />
          {reasons.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">Chưa có đánh giá thấp</p>
          ) : (
            <div className="space-y-2.5 px-5 pb-5">
              {reasons.map(([reason, n]) => (
                <div key={reason} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 truncate text-muted-foreground">{REASON_LABEL[reason] ?? reason}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-red-400" style={{ width: `${(n / maxReason) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right font-semibold tabular-nums">{n}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Yêu cầu hỗ trợ</h2>
        {s.tickets.length === 0 ? (
          <EmptyState icon={LifeBuoy} title="Chưa có yêu cầu hỗ trợ" />
        ) : (
          <List>
            {s.tickets.map((t) => (
              <div key={t.id} className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge tone={TICKET_TONE[t.status as keyof typeof TICKET_TONE] ?? 'neutral'} dot>
                      {TICKET_LABEL[t.status as keyof typeof TICKET_LABEL] ?? t.status}
                    </Badge>
                    <Badge>{t.category}</Badge>
                    <span>@{t.user ?? 'ẩn danh'}</span>
                    <span>· {formatRelativeTime(t.createdAt)}</span>
                  </div>
                  <p className="text-sm text-foreground">{t.message}</p>
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-1.5">
                    {t.status !== 'resolved' && (
                      <Button size="sm" onClick={() => update.mutate({ id: t.id, status: 'resolved' })}>
                        <CheckCircle2 /> Xong
                      </Button>
                    )}
                    {t.status !== 'closed' && (
                      <Button size="icon-sm" variant="ghost" title="Đóng" onClick={() => update.mutate({ id: t.id, status: 'closed' })}>
                        <XCircle />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </List>
        )}
      </div>
    </div>
  )
}

function SkillsSection({ canManage }: { canManage: boolean }) {
  const state = useListState({ sort: 'installs' })
  const list = usePaged<AdminAiSkillRow>('ai-skills', '/admin/ai/skills', state.params, ['q', 'status'])
  const rows = list.data?.items ?? []
  const mod = useAiMutation(
    ({ id, isPublic, enabled }: { id: string; isPublic?: boolean; enabled?: boolean }) => adminApi.patch(`/admin/ai/skills/${id}`, { isPublic, enabled }),
    'Đã cập nhật skill'
  )

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ListSearch state={state} placeholder="Tên skill, slug, @tác giả" />
        <Segmented
          value={state.params.status ?? ''}
          onChange={(v) => state.set({ status: v })}
          items={[
            { id: '', label: 'Tất cả' },
            { id: 'public', label: 'Công khai' },
            { id: 'private', label: 'Riêng tư' },
            { id: 'disabled', label: 'Đã tắt' }
          ]}
        />
        {list.data && <span className="ml-auto text-sm tabular-nums text-muted-foreground">{formatNumber(list.data.total)} skill</span>}
      </div>

      {list.isPending ? (
        <LoadingRows rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Sparkles} title="Không có skill phù hợp" />
      ) : (
        <div className={cn(list.isPlaceholderData && 'opacity-60')}>
          <Table>
            <THead>
              <Th>Skill</Th>
              <Th className="hidden sm:table-cell">Tác giả</Th>
              <SortTh id="installs" sort={state.sort} dir={state.dir} onSort={state.onSort} align="right" className="hidden md:table-cell">
                Cài đặt
              </SortTh>
              <SortTh id="uses" sort={state.sort} dir={state.dir} onSort={state.onSort} align="right" className="hidden md:table-cell">
                Lượt dùng
              </SortTh>
              <SortTh id="recent" sort={state.sort} dir={state.dir} onSort={state.onSort} className="hidden lg:table-cell">
                Ngày tạo
              </SortTh>
              <Th>Trạng thái</Th>
              {canManage && <Th className="w-12" />}
            </THead>
            <TBody>
              {rows.map((s) => (
                <Tr key={s.id}>
                  <Td className="max-w-[340px]">
                    <p className="truncate font-semibold text-foreground">{s.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.description || `/${s.slug}`}</p>
                  </Td>
                  <Td className="hidden text-muted-foreground sm:table-cell">@{s.owner.username}</Td>
                  <Td className="hidden text-right tabular-nums md:table-cell">{formatNumber(s.installCount)}</Td>
                  <Td className="hidden text-right tabular-nums md:table-cell">{formatNumber(s.useCount)}</Td>
                  <Td className="hidden text-muted-foreground lg:table-cell">{new Date(s.createdAt).toLocaleDateString('vi-VN')}</Td>
                  <Td>
                    {!s.enabled ? <Badge tone="danger">Tắt</Badge> : s.isPublic ? <Badge tone="primary">Công khai</Badge> : <Badge>Riêng tư</Badge>}
                  </Td>
                  {canManage && (
                    <Td className="text-right">
                      <Menu>
                        {s.isPublic && (
                          <MenuItem icon={EyeOff} onSelect={() => mod.mutate({ id: s.id, isPublic: false })}>
                            Gỡ khỏi công khai
                          </MenuItem>
                        )}
                        <MenuItem icon={s.enabled ? Ban : Power} danger={s.enabled} onSelect={() => mod.mutate({ id: s.id, enabled: !s.enabled })}>
                          {s.enabled ? 'Vô hiệu hóa' : 'Bật lại'}
                        </MenuItem>
                      </Menu>
                    </Td>
                  )}
                </Tr>
              ))}
            </TBody>
          </Table>
          <ListFooter state={state} total={list.data?.total ?? 0} />
        </div>
      )}
    </>
  )
}
