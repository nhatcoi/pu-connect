import React, { useState } from 'react'
import { FileText, Heart, MessageCircle, Pause, Play } from 'lucide-react'
import { BOT_SPEEDS, type AdminBotOverview } from '@pu/schemas'
import { adminApi, formatNumber, formatRelativeTime } from '@/lib/api'
import { Badge, Button, Card, CardHeader, Field, LoadingRows, PageHeader, Segmented, Stat } from '@/components/ui'
import { BotAccountsTab } from './bot-accounts-tab'
import { BotActionDialog, type BotActionPreset } from './bot-action-dialog'
import { BotActivityLog } from './bot-activity-log'
import { BotScheduleCard } from './bot-schedule-card'
import { AiConfigCard, TopicsCard } from './bot-settings-cards'
import { useBotMutation, useBotOverview } from './use-bots'

const SPEED_LABEL = { slow: 'Chậm (20–60 phút)', normal: 'Vừa (5–15 phút)', fast: 'Nhanh (1–3 phút)' } as const

export function BotsPage() {
  const overview = useBotOverview()
  const data = overview.data
  const [action, setAction] = useState<BotActionPreset | null>(null)

  return (
    <>
      <PageHeader
        title="Bot"
        description="Tạo bot, viết soul, cấp quyền. Bot tự đăng theo soul hoặc theo lịch import từ Excel, và tương tác (bình luận, thả tim) với bot khác và người thật. Chỉ làm đúng chủ đề, trong hạn mức ngày. Tool crawl dữ liệu là phần riêng, ra file Excel."
      />

      {overview.isPending || !data ? (
        <LoadingRows rows={4} />
      ) : (
        <div className="space-y-5">
          <ControlCards data={data} />
          <BotAccountsTab data={data} onAct={setAction} />
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <AiConfigCard key={`${data.ai.model}|${data.ai.baseUrl}`} data={data} />
            <TopicsCard topics={data.topics} />
          </div>
          <BotScheduleCard data={data} onAct={setAction} />
          <BotActivityLog bots={data.bots.map((b) => b.username)} />
        </div>
      )}

      <BotActionDialog preset={action} bots={data?.bots ?? []} onClose={() => setAction(null)} />
    </>
  )
}

// Công tắc daemon (tự đăng + tương tác), tốc độ, thống kê
function ControlCards({ data }: { data: AdminBotOverview }) {
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
    </div>
  )
}
