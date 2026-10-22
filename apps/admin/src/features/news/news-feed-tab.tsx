import React, { useState } from 'react'
import { Check, ExternalLink, Globe, Loader2, Send, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import type { NewsArticle, NewsCategory, NewsOverview, NewsStatus } from '@pu/schemas'
import { formatRelativeTime } from '@/lib/api'
import { Badge, Button, Card, EmptyState, Segmented } from '@/components/ui'
import { usePublishArticle, useUpdateArticleStatus } from './use-news'

const CATEGORY_LABELS: Record<string, string> = {
  all: 'Tất cả',
  ai: 'Trí tuệ nhân tạo (AI)',
  tech: 'Công nghệ',
  security: 'An ninh mạng',
  robotics: 'Robotics',
  general: 'Chung'
}

const STATUS_TONES: Record<NewsStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  pending: 'warning',
  approved: 'neutral',
  posted: 'success',
  rejected: 'danger'
}

const STATUS_LABELS: Record<NewsStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  posted: 'Đã đăng PUC',
  rejected: 'Bỏ qua'
}

export function NewsFeedTab({ data }: { data: NewsOverview }) {
  const [cat, setCat] = useState<string>('all')
  const [status, setStatus] = useState<string>('all')

  const publish = usePublishArticle()
  const updateStatus = useUpdateArticleStatus()

  const filtered = data.articles.filter((a) => {
    if (cat !== 'all' && a.category !== cat) return false
    if (status !== 'all' && a.status !== status) return false
    return true
  })

  const handlePublish = (article: NewsArticle) => {
    publish.mutate(
      { id: article.id, input: { bot: data.config.defaultBot } },
      {
        onSuccess: () => toast.success(`Đã đăng bài lên PUC dưới tên @${data.config.defaultBot}!`),
        onError: (err: any) => toast.error(err.message || 'Lỗi khi đăng bài')
      }
    )
  }

  const handleReject = (article: NewsArticle) => {
    updateStatus.mutate(
      { id: article.id, status: 'rejected' },
      { onSuccess: () => toast.success('Đã bỏ qua bài viết') }
    )
  }

  return (
    <div className="space-y-4">
      {/* Thanh bộ lọc */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={cat}
            onChange={setCat}
            items={Object.entries(CATEGORY_LABELS).map(([id, label]) => ({ id, label }))}
          />
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            value={status}
            onChange={setStatus}
            items={[
              { id: 'all', label: 'Mọi trạng thái' },
              { id: 'pending', label: 'Chờ duyệt' },
              { id: 'posted', label: 'Đã đăng' },
              { id: 'rejected', label: 'Bỏ qua' }
            ]}
          />
        </div>
      </div>

      {/* Danh sách bài viết */}
      {filtered.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={Globe}
            title="Chưa có bài viết nào"
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <Card key={a.id} className="p-4 transition-all hover:border-border/80">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge tone={STATUS_TONES[a.status]}>{STATUS_LABELS[a.status]}</Badge>
                    <Badge tone="neutral">{CATEGORY_LABELS[a.category] || a.category}</Badge>
                    <span className="font-medium text-foreground">{a.sourceName}</span>
                    <span className="text-muted-foreground">· {formatRelativeTime(a.publishedAt)}</span>
                  </div>

                  <h3 className="text-base font-semibold text-foreground leading-snug">
                    {a.title}
                  </h3>

                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {a.summary}
                  </p>

                  {a.impact && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs text-foreground">
                      <span className="font-semibold text-primary">Tác động:</span> {a.impact}
                    </div>
                  )}

                  <div className="pt-1">
                    <a
                      href={a.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ExternalLink className="size-3" />
                      <span>Bài viết gốc</span>
                    </a>
                  </div>
                </div>

                {/* Thao tác */}
                <div className="flex shrink-0 items-center gap-2 pt-2 lg:pt-0">
                  {a.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        variant="primary"
                        loading={publish.isPending && publish.variables?.id === a.id}
                        disabled={publish.isPending}
                        onClick={() => handlePublish(a)}
                      >
                        <Send className="size-3.5" /> Đăng qua @{data.config.defaultBot}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={updateStatus.isPending}
                        onClick={() => handleReject(a)}
                      >
                        <X className="size-3.5" /> Bỏ qua
                      </Button>
                    </>
                  )}

                  {a.status === 'posted' && (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <Check className="size-3.5" /> Đã đăng bởi @{a.postedBy || data.config.defaultBot}
                    </span>
                  )}

                  {a.status === 'rejected' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus.mutate({ id: a.id, status: 'pending' })}
                    >
                      Khôi phục
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
