import React, { useState } from 'react'
import { Bot, FileText, Heart, MessageCircle, Sparkles, Users, Zap } from 'lucide-react'
import type { AdminBotOverview } from '@pu/schemas'
import { formatNumber } from '@/lib/api'
import { Badge, Button, Card, CardHeader, LoadingRows, PageHeader, Stat } from '@/components/ui'
import { BotAccountsTab } from './bot-accounts-tab'
import { BotActionDialog, type BotActionPreset } from './bot-action-dialog'
import { BotActivityLog } from './bot-activity-log'
import { BotScheduleCard } from './bot-schedule-card'
import { AiConfigCard, TopicsCard } from './bot-settings-cards'
import { useBotOverview } from './use-bots'

export function BotsPage() {
  const overview = useBotOverview()
  const data = overview.data
  const [action, setAction] = useState<BotActionPreset | null>(null)

  return (
    <>
      <PageHeader
        title="Quản lý & Điều hành Bot"
        actions={
          <Button variant="primary" onClick={() => setAction({})}>
            <Zap className="size-4" /> Điều hành nhanh
          </Button>
        }
      />

      {overview.isPending || !data ? (
        <LoadingRows rows={4} />
      ) : (
        <div className="space-y-5">
          {/* Dashboard thống kê toàn diện về Bot */}
          <BotStatsOverview data={data} onQuickCommand={() => setAction({})} />

          {/* Danh sách Bot & thao tác */}
          <BotAccountsTab data={data} onAct={setAction} />

          {/* Lịch đăng & việc đã giao cho bot */}
          <BotScheduleCard data={data} onAct={setAction} />

          {/* Nhật ký hoạt động của bot */}
          <BotActivityLog bots={data.bots.map((b) => b.username)} />

          {/* Cấu hình AI & Chủ đề */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <AiConfigCard key={`${data.ai.model}|${data.ai.baseUrl}`} data={data} />
            <TopicsCard topics={data.topics} />
          </div>
        </div>
      )}

      {/* Modal điều hành Bot */}
      <BotActionDialog preset={action} bots={data?.bots ?? []} onClose={() => setAction(null)} />
    </>
  )
}

function BotStatsOverview({
  data
}: {
  data: AdminBotOverview
  onQuickCommand: () => void
}) {
  const activeBots = data.bots.filter((b) => b.profile.enabled).length

  return (
    <Card>
      <CardHeader title="Tổng quan" />
      <div className="p-4 pt-0">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          <Stat
            label="Tổng số Bot"
            value={formatNumber(data.bots.length)}
            icon={Users}
            sub={`${activeBots} đang hoạt động`}
          />
          <Stat
            label="Đang hoạt động"
            value={formatNumber(activeBots)}
            icon={Bot}
            sub={`${data.bots.length - activeBots} tạm dừng`}
          />
          <Stat
            label="Bài đăng của Bot"
            value={formatNumber(data.stats?.postsCount ?? 0)}
            icon={FileText}
          />
          <Stat
            label="Bình luận của Bot"
            value={formatNumber(data.stats?.commentsCount ?? 0)}
            icon={MessageCircle}
          />
          <Stat
            label="Lượt thích"
            value={formatNumber(data.stats?.likesCount ?? 0)}
            icon={Heart}
          />
        </div>
      </div>
    </Card>
  )
}
