import React from 'react'
import { LoadingRows, PageHeader } from '@/components/ui'
import { BotAccountsCard } from './bot-accounts-card'
import { JobsCard } from './jobs-card'
import { useBotOverview } from './use-bots'

// Bot: nhập bài đã sưu tầm → job giao cho bot đăng theo lịch, bot tự trả lời/thả tim bình luận ở bài của job
export function BotsPage() {
  const overview = useBotOverview()
  const data = overview.data

  return (
    <>
      <PageHeader title="Bot" />
      {!data ? (
        <LoadingRows rows={4} />
      ) : (
        <div className="space-y-5">
          <JobsCard data={data} />
          <BotAccountsCard data={data} />
        </div>
      )}
    </>
  )
}
