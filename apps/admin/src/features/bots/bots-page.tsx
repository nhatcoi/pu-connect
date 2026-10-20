import React, { useState } from 'react'
import { FileText, Heart, MessageCircle, Pause, Play } from 'lucide-react'
import { BOT_SPEEDS, type AdminBotOverview } from '@pu/schemas'
import { adminApi, formatNumber, formatRelativeTime } from '@/lib/api'
import { Badge, Button, Card, CardHeader, Field, LoadingRows, PageHeader, Segmented, Stat, Tabs } from '@/components/ui'
import { BotAccountsTab } from './bot-accounts-tab'
import { BotActionDialog, type BotActionPreset } from './bot-action-dialog'
import { BotActivityLog } from './bot-activity-log'
import { BotContentTab } from './bot-content-tab'
import { AiConfigCard, TopicsCard } from './bot-settings-cards'
import { useBotMutation, useBotOverview } from './use-bots'

const SPEED_LABEL = { slow: 'Chậm (20–60 phút)', normal: 'Vừa (5–15 phút)', fast: 'Nhanh (1–3 phút)' } as const

type BotTab = 'overview' | 'content' | 'accounts' | 'settings' | 'log'
const TABS: { id: BotTab; label: string }[] = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'content', label: 'Nội dung & hành động' },
  { id: 'accounts', label: 'Tài khoản bot' },
  { id: 'settings', label: 'AI & chủ đề' },
  { id: 'log', label: 'Nhật ký' }
]

export function BotsPage() {
  const overview = useBotOverview()
  const data = overview.data
  const [tab, setTab] = useState<BotTab>('overview')
  const [action, setAction] = useState<BotActionPreset | null>(null)

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
          <Tabs value={tab} onChange={setTab} items={TABS.map((t) => (t.id === 'content' ? { ...t, count: data.commands.filter((c) => c.status === 'pending').length } : t))} />
          {tab === 'overview' && <OverviewTab data={data} />}
          {tab === 'content' && <BotContentTab data={data} onAct={setAction} />}
          {tab === 'accounts' && <BotAccountsTab data={data} onAct={setAction} />}
          {tab === 'settings' && (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <AiConfigCard key={`${data.ai.model}|${data.ai.baseUrl}`} data={data} />
              <TopicsCard topics={data.topics} />
            </div>
          )}
          {tab === 'log' && <BotActivityLog bots={data.bots.map((b) => b.username)} />}
        </div>
      )}

      <BotActionDialog preset={action} bots={data?.bots ?? []} onClose={() => setAction(null)} />
    </>
  )
}

// Công tắc daemon, tốc độ, đăng bài crawl
function OverviewTab({ data }: { data: AdminBotOverview }) {
  const control = useBotMutation((body: Parameters<typeof adminApi.patch>[1]) => adminApi.patch<AdminBotOverview>('/admin/bots/control', body))
  return (
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

    </div>
  )
}
