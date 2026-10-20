import React, { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Bot, FileText, Heart, MessageCircle, Pause, Play, Send, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { BOT_SPEEDS, type AdminBotAccount, type AdminBotActivity, type AdminBotCommand, type AdminBotCommandInput, type AdminBotOverview, type AdminPage, type BotCommandType, type BotProfile } from '@pu/schemas'
import { adminApi, cn, formatNumber, formatRelativeTime } from '@/lib/api'
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, List, LoadingRows, PageHeader, Segmented, Select, Stat, Table, TBody, Td, Th, THead, Tr } from '@/components/ui'
import { BotProfileDialog } from './bot-profile-dialog'
import { AiConfigCard, TopicsCard } from './bot-settings-cards'
import { FeedQueueCard } from './feed-queue-card'
import { POLL_MS, useBotMutation, useBotOverview } from './use-bots'

const SPEED_LABEL = { slow: 'Chậm (20–60 phút)', normal: 'Vừa (5–15 phút)', fast: 'Nhanh (1–3 phút)' } as const
const COMMAND_LABEL: Record<BotCommandType, string> = { post: 'Đăng bài', comment: 'Bình luận' }
const STATUS_TONE = { pending: 'neutral', running: 'primary', done: 'success', failed: 'danger' } as const
const STATUS_LABEL = { pending: 'Chờ', running: 'Đang chạy', done: 'Xong', failed: 'Lỗi' } as const

export function BotsPage() {
  const overview = useBotOverview()
  const data = overview.data
  const [editing, setEditing] = useState<AdminBotAccount | null>(null)

  const control = useBotMutation((body: Parameters<typeof adminApi.patch>[1]) => adminApi.patch<AdminBotOverview>('/admin/bots/control', body))
  const saveProfile = useBotMutation(
    (v: { username: string; draft: Partial<BotProfile> }) => adminApi.patch<AdminBotOverview>(`/admin/bots/profiles/${v.username}`, v.draft),
    () => {
      setEditing(null)
      toast.success('Đã lưu cấu hình bot')
    }
  )

  return (
    <>
      <PageHeader
        title="Bot"
        description="Bot chỉ làm việc admin cho phép: đúng chủ đề, có hạn mức mỗi ngày, không chen vào cuộc trò chuyện của người thật. Bot chạy ở tiến trình riêng; trang này chỉ điều khiển."
      />

      {overview.isPending || !data ? (
        <LoadingRows rows={4} />
      ) : (
        <div className="space-y-5">
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  Mô phỏng tương tác
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
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Bài đăng" value={formatNumber(data.stats?.postsCount ?? 0)} icon={FileText} sub="từ lúc daemon khởi động" />
                <Stat label="Bình luận" value={formatNumber(data.stats?.commentsCount ?? 0)} icon={MessageCircle} />
                <Stat label="Lượt thích" value={formatNumber(data.stats?.likesCount ?? 0)} icon={Heart} />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  Đăng bài từ dữ liệu crawl
                  <Badge tone={data.feedEnabled ? 'primary' : 'neutral'}>{data.feedEnabled ? 'Đang bật' : 'Tắt'}</Badge>
                </span>
              }
              description="Các bot được bật “đăng bài từ dữ liệu crawl” thay phiên đăng 1 bài đã được AI duyệt mỗi 30–120 phút (kèm ảnh nếu có, không link Facebook, không trùng), nghỉ 00:00–06:00."
              action={
                <Button variant={data.feedEnabled ? 'outline' : 'primary'} loading={control.isPending} onClick={() => control.mutate({ feedEnabled: !data.feedEnabled })}>
                  {data.feedEnabled ? <Pause /> : <Play />}
                  {data.feedEnabled ? 'Tạm dừng' : 'Bật đăng bài'}
                </Button>
              }
            />
          </Card>

          <BotTable bots={data.bots} topicsLabel={Object.fromEntries(data.topics.map((t) => [t.slug, t.label]))} onEdit={setEditing} />

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <AiConfigCard key={`${data.ai.model}|${data.ai.baseUrl}`} data={data} />
            <TopicsCard topics={data.topics} />
          </div>

          <FeedQueueCard overview={data} />

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <CommandForm bots={data.bots.map((b) => b.username)} />
            <CommandHistory commands={data.commands} />
          </div>

          <ActivityLog bots={data.bots.map((b) => b.username)} />
        </div>
      )}

      <BotProfileDialog bot={editing} topics={data?.topics ?? []} saving={saveProfile.isPending} onClose={() => setEditing(null)} onSave={(username, draft) => saveProfile.mutate({ username, draft })} />
    </>
  )
}

/* ── Danh sách bot ─────────────────────────────────────── */

function permissions(p: BotProfile): string[] {
  return [p.canPost && 'đăng bài', p.canComment && 'bình luận', p.canLike && 'thả tim', p.feedPoster && 'đăng crawl'].filter(Boolean) as string[]
}

function BotTable({ bots, topicsLabel, onEdit }: { bots: AdminBotAccount[]; topicsLabel: Record<string, string>; onEdit: (b: AdminBotAccount) => void }) {
  return (
    <Card>
      <CardHeader title={`Tài khoản bot (${bots.length})`} description="Bấm Cấu hình để đặt quyền, chủ đề và hạn mức từng bot. Mặc định mọi quyền tắt." />
      {bots.length === 0 ? (
        <EmptyState icon={Bot} title="Chưa có bot" description="Chạy pnpm bot:setup để tạo tài khoản bot." />
      ) : (
        <Table className="rounded-none border-x-0 border-b-0">
          <THead>
            <Th>Bot</Th>
            <Th>Được phép</Th>
            <Th className="hidden lg:table-cell">Chủ đề</Th>
            <Th className="hidden sm:table-cell text-right">Hôm nay (bài/bl/tim)</Th>
            <Th className="text-right"> </Th>
          </THead>
          <TBody>
            {bots.map((b) => {
              const perms = permissions(b.profile)
              return (
                <Tr key={b.id}>
                  <Td>
                    <a href={`#/users?user=${b.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                      {b.displayName}
                    </a>
                    <span className="ml-1.5 text-xs text-muted-foreground">@{b.username}</span>
                    {!b.profile.enabled && (
                      <Badge tone="danger" className="ml-2">
                        Tắt
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {perms.length ? perms.map((p) => <Badge key={p}>{p}</Badge>) : <span className="text-xs text-muted-foreground">Chưa cấp quyền</span>}
                      {b.profile.interactHumans && <Badge tone="warning">người thật</Badge>}
                    </div>
                  </Td>
                  <Td className="hidden text-xs text-muted-foreground lg:table-cell">{b.profile.topics.map((t) => topicsLabel[t] ?? t).join(' · ') || '—'}</Td>
                  <Td className="hidden text-right tabular-nums sm:table-cell">
                    {b.usedToday.post}/{b.profile.maxPostsPerDay} · {b.usedToday.comment}/{b.profile.maxCommentsPerDay} · {b.usedToday.like}/{b.profile.maxLikesPerDay}
                  </Td>
                  <Td className="text-right">
                    <Button size="sm" onClick={() => onEdit(b)}>
                      <Settings2 /> Cấu hình
                    </Button>
                  </Td>
                </Tr>
              )
            })}
          </TBody>
        </Table>
      )}
    </Card>
  )
}

/* ── Lệnh thủ công ─────────────────────────────────────── */

function CommandForm({ bots }: { bots: string[] }) {
  const [type, setType] = useState<BotCommandType>('post')
  const [bot, setBot] = useState('')
  const [topic, setTopic] = useState('')
  const [postId, setPostId] = useState('')

  const send = useBotMutation(
    (body: AdminBotCommandInput) => adminApi.post<AdminBotOverview>('/admin/bots/commands', body),
    () => {
      toast.success('Đã xếp lệnh, bot sẽ chạy trong vài giây')
      setTopic('')
      setPostId('')
    }
  )
  const build = (): AdminBotCommandInput =>
    type === 'post' ? { type, bot: bot || undefined, topic: topic.trim() || undefined } : { type, postId: postId.trim(), bot: bot || undefined }

  return (
    <Card>
      <CardHeader title="Chạy thủ công" description="Ép bot làm ngay một việc (bỏ qua hạn mức; bài tự sinh vẫn theo chủ đề của bot, bot đang tắt thì không chạy)." />
      <div className="space-y-3 p-4 pt-0">
        <Segmented value={type} onChange={setType} items={(Object.keys(COMMAND_LABEL) as BotCommandType[]).map((id) => ({ id, label: COMMAND_LABEL[id] }))} />
        <Field label="Bot">
          <Select value={bot} onChange={(e) => setBot(e.target.value)}>
            <option value="">Ngẫu nhiên</option>
            {bots.map((b) => (
              <option key={b} value={b}>
                @{b}
              </option>
            ))}
          </Select>
        </Field>
        {type === 'comment' ? (
          <Field label="ID bài viết">
            <Input value={postId} onChange={(e) => setPostId(e.target.value)} placeholder="UUID bài viết" className="font-mono" />
          </Field>
        ) : (
          <Field label="Gợi ý nội dung" hint="Tùy chọn, trong chủ đề của bot">
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} placeholder="VD: mẹo ôn thi cuối kỳ" />
          </Field>
        )}
        <Button variant="primary" loading={send.isPending} disabled={type === 'comment' && !postId.trim()} onClick={() => send.mutate(build())}>
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
