import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, Sparkles } from 'lucide-react'
import type { InterestKind, UserEventType, UserInsight } from '@pu/schemas'
import { adminApi, cn, formatRelativeTime } from '@/lib/api'
import { Badge, Dialog, ErrorState, Skeleton } from '@/components/ui'

const EVENT_LABELS: Record<UserEventType, string> = {
  post_view: 'Xem bài',
  post_open: 'Mở bài',
  doc_open: 'Mở tài liệu',
  doc_download: 'Tải tài liệu',
  search: 'Tìm kiếm',
  search_click: 'Bấm kết quả',
  ai_suggestion_click: 'Bấm gợi ý AI'
}

const KIND_LABELS: Record<InterestKind, string> = { course: 'Môn', tag: 'Tag', query: 'Từ khóa' }

const SIGNALS: { key: keyof UserInsight['signals']; label: string }[] = [
  { key: 'postsAuthored', label: 'Đăng bài' },
  { key: 'docsUploaded', label: 'Tải lên' },
  { key: 'postsSaved', label: 'Lưu bài' },
  { key: 'studyGroups', label: 'Nhóm học' },
  { key: 'comments', label: 'Bình luận' },
  { key: 'aiQuestions', label: 'Hỏi PU AI' },
  { key: 'reactions', label: 'Cảm xúc' }
]

// Dữ liệu cá nhân hóa của 1 người — mỗi lần mở đều ghi Nhật ký kiểm toán
export function UserInsightModal({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['admin', 'insight', userId],
    queryFn: () => adminApi.get<UserInsight>(`/admin/users/${userId}/insight`),
    enabled: !!userId,
    staleTime: 0
  })

  return (
    <Dialog
      open={!!userId}
      onClose={onClose}
      size="lg"
      title={data ? data.user.displayName : 'Insight'}
      description={
        <span className="inline-flex items-center gap-1.5">
          <Eye className="size-3.5" /> Lượt xem này được ghi vào nhật ký
        </span>
      }
    >
      {isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-40" />
        </div>
      ) : isError ? (
        <ErrorState message={(error as Error).message} />
      ) : (
        <InsightContent d={data} />
      )}
    </Dialog>
  )
}

function InsightContent({ d }: { d: UserInsight }) {
  const maxScore = d.interests[0]?.score || 1
  const events = Object.entries(d.eventCounts) as [UserEventType, number][]

  return (
    <div className="space-y-6 text-sm">
      <dl className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-2">
        <dt className="text-muted-foreground">Ngành / lớp</dt>
        <dd className="text-foreground">{[d.user.major, d.user.className].filter(Boolean).join(' · ') || '—'}</dd>
        <dt className="text-muted-foreground">Sở thích</dt>
        <dd className="text-foreground">{d.user.interests.join(', ') || '—'}</dd>
        <dt className="text-muted-foreground">Kỹ năng</dt>
        <dd className="text-foreground">{d.user.skills.join(', ') || '—'}</dd>
        <dt className="text-muted-foreground">Hoạt động</dt>
        <dd className="text-foreground">{formatRelativeTime(d.user.lastSeenAt)}</dd>
        <dt className="text-muted-foreground">Cá nhân hóa</dt>
        <dd>{d.personalization ? <Badge tone="success">Bật</Badge> : <Badge tone="danger">Tắt</Badge>}</dd>
      </dl>

      <Section title="Hoạt động">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {SIGNALS.map((x) => (
            <div key={x.key} className="rounded-lg bg-muted/60 px-2 py-2 text-center">
              <p className="text-base font-bold tabular-nums text-foreground">{d.signals[x.key]}</p>
              <p className="truncate text-[11px] text-muted-foreground">{x.label}</p>
            </div>
          ))}
        </div>
        {events.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {events.map(([type, n]) => (
              <Badge key={type}>
                {EVENT_LABELS[type] ?? type} · {n}
              </Badge>
            ))}
          </div>
        )}
      </Section>

      <Section title="Chủ đề quan tâm" hint={`${d.interests.length}`}>
        {d.interests.length === 0 ? (
          <p className="text-muted-foreground">Chưa có — đang dùng gợi ý mặc định</p>
        ) : (
          <ol className="space-y-1.5">
            {d.interests.map((t, i) => (
              <li key={`${t.kind}:${t.key}`} className={cn('flex items-center gap-3', i >= 12 && 'opacity-40')}>
                <span className="w-12 shrink-0 text-xs text-muted-foreground">{KIND_LABELS[t.kind]}</span>
                <span className="flex-1 truncate text-foreground">{t.label}</span>
                <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${(t.score / maxScore) * 100}%` }} />
                </span>
                <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{t.score.toFixed(2)}</span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {d.suggestionPreview.length > 0 && (
        <Section title="Gợi ý PU AI hiện tại">
          <div className="flex flex-wrap gap-1.5">
            {d.suggestionPreview.map((s) => (
              <span
                key={s.text}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs',
                  s.topic ? 'border-primary/30 bg-primary/5 text-primary' : 'border-border text-muted-foreground'
                )}
              >
                {s.topic && <Sparkles className="size-3" />}
                {s.text}
              </span>
            ))}
          </div>
        </Section>
      )}

      <Section title="Câu hỏi PU AI gần đây">
        {d.aiQuestions.length === 0 ? (
          <p className="text-muted-foreground">Chưa có</p>
        ) : (
          <ul className="divide-y divide-border">
            {d.aiQuestions.map((q, i) => (
              <li key={i} className="flex items-start gap-3 py-2">
                <span className="line-clamp-2 flex-1 text-foreground">{q.text}</span>
                {q.courses.length > 0 && (
                  <Badge tone="primary" className="font-mono">
                    {q.courses.join(', ')}
                  </Badge>
                )}
                <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(q.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
        {hint && <span className="ml-1.5 font-normal normal-case tracking-normal">· {hint}</span>}
      </h3>
      {children}
    </section>
  )
}
