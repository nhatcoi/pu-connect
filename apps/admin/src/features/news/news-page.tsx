import React, { useState } from 'react'
import {
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Globe,
  Loader2,
  Newspaper,
  RefreshCw,
  Rss,
  Settings,
  Sparkles
} from 'lucide-react'
import { toast } from 'sonner'
import { formatNumber } from '@/lib/api'
import { Button, Card, LoadingRows, PageHeader, Segmented, Stat } from '@/components/ui'
import { NewsConfigTab } from './news-config-tab'
import { NewsFeedTab } from './news-feed-tab'
import { NewsSourcesTab } from './news-sources-tab'
import { useFetchNews, useNewsOverview } from './use-news'

export function NewsPage() {
  const [tab, setTab] = useState<'feed' | 'sources' | 'config'>('feed')
  const overview = useNewsOverview()
  const fetchNews = useFetchNews()

  const data = overview.data

  const handleFetch = () => {
    fetchNews.mutate(undefined, {
      onSuccess: (res) => {
        toast.success(`Đã quét xong ${res.fetched} nguồn! Tìm thấy ${res.newItems} bài mới.`)
      },
      onError: (err: any) => toast.error(err.message || 'Lỗi khi quét tin tức')
    })
  }

  return (
    <>
      <PageHeader
        title="Bộ thu thập tin tức (AI News Aggregator)"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              loading={fetchNews.isPending}
              disabled={fetchNews.isPending}
              onClick={handleFetch}
            >
              <RefreshCw className="size-4" /> Quét tin tức ngay
            </Button>
          </div>
        }
      />

      {overview.isPending || !data ? (
        <LoadingRows rows={4} />
      ) : (
        <div className="space-y-5">
          {/* Dashboard thống kê */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Tổng bài thu thập"
              value={formatNumber(data.stats.totalArticles)}
              icon={Newspaper}
            />
            <Stat
              label="Chờ duyệt"
              value={formatNumber(data.stats.pendingArticles)}
              icon={Clock}
              sub={data.config.autoPost ? 'Đang chạy Auto' : 'Chờ Admin duyệt'}
            />
            <Stat
              label="Đã đăng lên PUC"
              value={formatNumber(data.stats.postedArticles)}
              icon={CheckCircle2}
              sub={`Đăng bởi @${data.config.defaultBot}`}
            />
            <Stat
              label="Nguồn RSS"
              value={formatNumber(data.stats.totalSources)}
              icon={Rss}
              sub={`${data.sources.filter((s) => s.enabled).length} đang bật`}
            />
          </div>

          {/* Điều hướng Tab */}
          <div className="flex items-center justify-between border-b border-border pb-3">
            <Segmented
              value={tab}
              onChange={setTab}
              items={[
                { id: 'feed', label: `Bản tin thu thập (${data.articles.length})` },
                { id: 'sources', label: `Nguồn RSS (${data.sources.length})` },
                { id: 'config', label: 'Cấu hình & Telegram' }
              ]}
            />
          </div>

          {/* Nội dung theo Tab */}
          {tab === 'feed' && <NewsFeedTab data={data} />}
          {tab === 'sources' && <NewsSourcesTab data={data} />}
          {tab === 'config' && <NewsConfigTab data={data} />}
        </div>
      )}
    </>
  )
}
