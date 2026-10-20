import React, { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, Heart, MessageCircle, MessagesSquare, Pause, Play, Send, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { BOT_SPEEDS, type AdminBotActivity, type AdminBotCommand, type AdminBotCommandInput, type AdminBotControlInput, type AdminBotOverview, type AdminPage, type BotCommandType, type BotSpeed } from '@pu/schemas'
import { adminApi, cn, formatNumber, formatRelativeTime } from '@/lib/api'
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, List, LoadingRows, PageHeader, Segmented, Select, Stat, Table, TBody, Td, Th, THead, Tr } from '@/components/ui'

const SPEED_LABEL: Record<BotSpeed, string> = { slow: 'Chậm (20–60 phút)', normal: 'Vừa (5–15 phút)', fast: 'Nhanh (1–3 phút)' }
const COMMAND_LABEL: Record<BotCommandType, string> = { post: 'Đăng bài', chat: 'Chat 1-1', group: 'Chat nhóm', comment: 'Bình luận' }
const STATUS_TONE = { pending: 'neutral', running: 'primary', done: 'success', failed: 'danger' } as const
const STATUS_LABEL = { pending: 'Chờ', running: 'Đang chạy', done: 'Xong', failed: 'Lỗi' } as const
const POLL_MS = 5_000
const BOTS_KEY = ['admin', 'bots'] as const

export function BotsTab() {
  const qc = useQueryClient()
  const overview = useQuery({
    queryKey: BOTS_KEY,
    queryFn: () => adminApi.get<AdminBotOverview>('/admin/bots'),
    refetchInterval: POLL_MS
  })
  const data = overview.data

  const control = useMutation({
    mutationFn: (body: AdminBotControlInput) => adminApi.patch<AdminBotOverview>('/admin/bots/control', body),
    onSuccess: (res) => qc.setQueryData(BOTS_KEY, res),
    onError: (e: Error) => toast.error(e.message)
  })

  return (
    <>
      <PageHeader
        title="Bot"
        description="Tài khoản mô phỏng đăng bài, chat, bình luận để demo và thử tải. Bot chạy ở tiến trình riêng; trang này chỉ điều khiển."
      />

      {overview.isPending || !data ? (
        <LoadingRows rows={4} />
      ) : (
        <div className="space-y-5">
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  Trạng thái
                  <Badge tone={data.online ? 'success' : 'danger'} dot>
                    {data.online ? 'Daemon online' : 'Daemon offline'}
                  </Badge>
                  {data.online && <Badge tone={data.enabled ? 'primary' : 'neutral'}>{data.enabled ? 'Đang chạy' : 'Tạm dừng'}</Badge>}
                </span>
              }
              description={
                data.online
                  ? `Chạy từ ${formatRelativeTime(data.startedAt)} · heartbeat ${formatRelativeTime(data.heartbeatAt)}`
                  : 'Daemon chưa chạy. Trên VPS: systemctl start pu-bot. Lệnh vẫn được xếp hàng và chạy khi daemon sống lại.'
              }
              action={
                <Button variant={data.enabled ? 'outline' : 'primary'} loading={control.isPending} onClick={() => control.mutate({ enabled: !data.enabled })}>
                  {data.enabled ? <Pause /> : <Play />}
                  {data.enabled ? 'Tạm dừng' : 'Bật mô phỏng'}
                </Button>
              }
            />
            <div className="space-y-4 p-4 pt-0">
              <Field label="Tốc độ" hint={SPEED_LABEL[data.speed]}>
                <Segmented value={data.speed} onChange={(speed) => control.mutate({ speed })} items={BOT_SPEEDS.map((s) => ({ id: s, label: { slow: 'Chậm', normal: 'Vừa', fast: 'Nhanh' }[s] }))} />
              </Field>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <Stat label="Bài đăng" value={formatNumber(data.stats?.postsCount ?? 0)} icon={FileText} sub="từ lúc daemon khởi động" />
                <Stat label="Chat 1-1" value={formatNumber(data.stats?.directChatsCount ?? 0)} icon={MessageCircle} />
                <Stat label="Chat nhóm" value={formatNumber(data.stats?.groupChatsCount ?? 0)} icon={MessagesSquare} />
                <Stat label="Bình luận" value={formatNumber(data.stats?.commentsCount ?? 0)} icon={MessageCircle} />
                <Stat label="Lượt thích" value={formatNumber(data.stats?.likesCount ?? 0)} icon={Heart} />
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <CommandForm bots={data.bots.map((b) => b.username)} />
            <CommandHistory commands={data.commands} />
          </div>

          <BotTable data={data} />
          <ActivityLog bots={data.bots.map((b) => b.username)} />
        </div>
      )}
    </>
  )
}

/* ── Lệnh thủ công ─────────────────────────────────────── */

function CommandForm({ bots }: { bots: string[] }) {
  const qc = useQueryClient()
  const [type, setType] = useState<BotCommandType>('post')
  const [botA, setBotA] = useState('')
  const [botB, setBotB] = useState('')
  const [topic, setTopic] = useState('')
  const [postId, setPostId] = useState('')

  const send = useMutation({
    mutationFn: (body: AdminBotCommandInput) => adminApi.post<AdminBotOverview>('/admin/bots/commands', body),
    onSuccess: (res) => {
      qc.setQueryData(BOTS_KEY, res)
      toast.success('Đã xếp lệnh, bot sẽ chạy trong vài giây')
      setTopic('')
      setPostId('')
    },
    onError: (e: Error) => toast.error(e.message)
  })

  const build = (): AdminBotCommandInput => {
    const t = topic.trim() || undefined
    if (type === 'post') return { type, bot: botA || undefined, topic: t }
    if (type === 'chat') return { type, botA: botA || undefined, botB: botB || undefined, topic: t }
    if (type === 'group') return { type, topic: t }
    return { type, postId: postId.trim(), bot: botA || undefined }
  }
  const invalid = type === 'comment' && !postId.trim()
  const botSelect = (value: string, set: (v: string) => void, label: string) => (
    <Field label={label}>
      <Select value={value} onChange={(e) => set(e.target.value)}>
        <option value="">Ngẫu nhiên</option>
        {bots.map((b) => (
          <option key={b} value={b}>
            @{b}
          </option>
        ))}
      </Select>
    </Field>
  )

  return (
    <Card>
      <CardHeader title="Chạy thủ công" description="Ép bot làm ngay một việc, không phụ thuộc bật/tắt mô phỏng." />
      <div className="space-y-3 p-4 pt-0">
        <Segmented value={type} onChange={setType} items={(Object.keys(COMMAND_LABEL) as BotCommandType[]).map((id) => ({ id, label: COMMAND_LABEL[id] }))} />
        {type !== 'group' && botSelect(botA, setBotA, type === 'chat' ? 'Bot A' : 'Bot')}
        {type === 'chat' && botSelect(botB, setBotB, 'Bot B')}
        {type === 'comment' ? (
          <Field label="ID bài viết">
            <Input value={postId} onChange={(e) => setPostId(e.target.value)} placeholder="UUID bài viết" className="font-mono" />
          </Field>
        ) : (
          <Field label="Chủ đề" hint="Tùy chọn">
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} placeholder="VD: hỏi bài tập SQL" />
          </Field>
        )}
        <Button variant="primary" loading={send.isPending} disabled={invalid} onClick={() => send.mutate(build())}>
          <Send /> Gửi lệnh
        </Button>
      </div>
    </Card>
  )
}

function CommandHistory({ commands }: { commands: AdminBotCommand[] }) {
  return (
    <Card>
      <CardHeader title="Lệnh gần đây" />
      {commands.length === 0 ? (
        <EmptyState icon={Bot} title="Chưa có lệnh" description="Lệnh thủ công sẽ hiện ở đây." />
      ) : (
        <List className="rounded-none border-x-0 border-b-0">
          {commands.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{COMMAND_LABEL[c.type]}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.result && c.status === 'failed' ? c.result : Object.values(c.payload).filter(Boolean).join(' · ') || 'Ngẫu nhiên'}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                @{c.createdBy ?? '?'} · {formatRelativeTime(c.createdAt)}
              </span>
            </div>
          ))}
        </List>
      )}
    </Card>
  )
}

/* ── Danh sách bot & nhật ký ───────────────────────────── */

function BotTable({ data }: { data: AdminBotOverview }) {
  return (
    <Card>
      <CardHeader title={`Tài khoản bot (${data.bots.length})`} description="Tài khoản có cờ is_bot; tạo bằng pnpm bot:setup." />
      {data.bots.length === 0 ? (
        <EmptyState icon={Bot} title="Chưa có bot" description="Chạy pnpm bot:setup để tạo tài khoản bot." />
      ) : (
        <Table className="rounded-none border-x-0 border-b-0">
          <THead>
            <Th>Bot</Th>
            <Th className="hidden sm:table-cell">Khoa</Th>
            <Th className="text-right">24 giờ qua</Th>
            <Th className="text-right">Hoạt động cuối</Th>
          </THead>
          <TBody>
            {data.bots.map((b) => (
              <Tr key={b.id}>
                <Td>
                  <a href={`#/users?user=${b.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                    {b.displayName}
                  </a>
                  <span className="ml-1.5 text-xs text-muted-foreground">@{b.username}</span>
                </Td>
                <Td className="hidden sm:table-cell">{b.faculty ?? '—'}</Td>
                <Td className="text-right tabular-nums">{formatNumber(b.actions24h)}</Td>
                <Td className="text-right text-muted-foreground">{formatRelativeTime(b.lastActionAt)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  )
}

function ActivityLog({ bots }: { bots: string[] }) {
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
        description="Giữ 7 ngày."
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
        <EmptyState icon={Bot} title="Chưa có hoạt động" description="Bật mô phỏng hoặc gửi lệnh thủ công để thấy nhật ký." />
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
