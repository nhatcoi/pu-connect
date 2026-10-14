'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Sparkles } from 'lucide-react'
import type { InterestKind, UserEventType, UserInsight } from '@pu/schemas'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { cn, formatRelativeTime } from '@/lib/utils'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

const EVENT_LABELS: Record<UserEventType, string> = {
  post_view: 'Xem bài (≥2s)',
  post_open: 'Mở bài',
  doc_open: 'Mở tài liệu',
  doc_download: 'Tải tài liệu',
  search: 'Tìm kiếm',
  search_click: 'Bấm kết quả tìm',
  ai_suggestion_click: 'Bấm gợi ý AI'
}

const KIND_LABELS: Record<InterestKind, string> = { course: 'Môn', tag: 'Tag', query: 'Từ khóa' }

// Trọng số khớp interest-profile.sql.ts (chỉ để hiển thị)
const SIGNALS: { key: keyof UserInsight['signals']; label: string; weight: string }[] = [
  { key: 'postsAuthored', label: 'Đăng bài', weight: '5' },
  { key: 'docsUploaded', label: 'Tải tài liệu lên', weight: '5' },
  { key: 'postsSaved', label: 'Lưu bài', weight: '4' },
  { key: 'studyGroups', label: 'Nhóm học', weight: '4' },
  { key: 'comments', label: 'Bình luận', weight: '3' },
  { key: 'aiQuestions', label: 'Hỏi PU AI', weight: '3*' },
  { key: 'reactions', label: 'Thả cảm xúc', weight: '1' }
]

// Admin: dữ liệu cá nhân hóa của 1 người (mỗi lần mở được ghi nhật ký)
// Admin personalisation inspector; every open is audited server-side
export function UserInsightDialog({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.admin('insight', userId),
    queryFn: async () => (await apiClient<{ data: UserInsight }>(`/admin/users/${userId}/insight`)).data,
    enabled: !!userId,
    staleTime: 0
  })

  return (
    <Dialog open={!!userId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0 max-h-[90vh] overflow-y-auto">
        <DialogTitle className="px-5 pt-5 pb-1 text-[15px]">
          Dữ liệu cá nhân hóa{data && <span className="font-normal text-muted-foreground"> · @{data.user.username}</span>}
        </DialogTitle>
        {isPending ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : isError ? (
          <p className="p-5 text-sm text-destructive">{(error as Error).message}</p>
        ) : (
          <InsightBody insight={data} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function InsightBody({ insight: d }: { insight: UserInsight }) {
  const maxScore = d.interests[0]?.score || 1
  const eventEntries = Object.entries(d.eventCounts) as [UserEventType, number][]

  return (
    <div className="px-5 pb-5 space-y-4 text-sm">
      <p className="text-[11px] text-muted-foreground">Chỉ đọc · lượt xem này được ghi vào Nhật ký quản trị.</p>

      <Section title="Hồ sơ">
        <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-xs">
          <Field label="Tên">{d.user.displayName}</Field>
          <Field label="Ngành / lớp">{[d.user.major, d.user.className].filter(Boolean).join(' · ') || '—'}</Field>
          <Field label="Sở thích">{d.user.interests.join(', ') || '—'}</Field>
          <Field label="Kỹ năng">{d.user.skills.join(', ') || '—'}</Field>
          <Field label="Hoạt động">{d.user.lastSeenAt ? formatRelativeTime(d.user.lastSeenAt) : '—'}</Field>
          <Field label="Cá nhân hóa">
            {d.personalization ? <span className="text-primary font-semibold">Bật</span> : <span className="text-destructive font-semibold">Tắt (đã xóa dữ liệu)</span>}
          </Field>
          <Field label="Tính hồ sơ">
            {d.profileUpdatedAt ? formatRelativeTime(d.profileUpdatedAt) : 'Chưa tính'}
            {d.profileStale && <span className="ml-1.5 text-brand-orange">· cũ, sẽ tính lại khi mở PU AI</span>}
          </Field>
        </dl>
      </Section>

      <Section title={`Chủ đề quan tâm (${d.interests.length})`} hint="Gợi ý AI đọc top 12">
        {d.interests.length === 0 ? (
          <Empty text="Chưa có chủ đề — PU AI đang dùng gợi ý mặc định." />
        ) : (
          <ol className="space-y-1">
            {d.interests.map((t, i) => (
              <li key={`${t.kind}:${t.key}`} className={cn('flex items-center gap-2 text-xs', i >= 12 && 'opacity-50')}>
                <span className="w-5 text-right tabular-nums text-muted-foreground">{i + 1}</span>
                <span className="w-14 shrink-0 rounded bg-muted px-1.5 py-0.5 text-center text-[10px]">{KIND_LABELS[t.kind]}</span>
                <span className="flex-1 truncate">{t.label}</span>
                <span className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                  <span className="block h-full bg-primary" style={{ width: `${(t.score / maxScore) * 100}%` }} />
                </span>
                <span className="w-10 text-right tabular-nums font-semibold">{t.score.toFixed(2)}</span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="Gợi ý PU AI hiện tại" hint="Chế độ Hỏi đáp">
        <div className="flex flex-wrap gap-1.5">
          {d.suggestionPreview.map((s) => (
            <span key={s.text} className={cn('rounded-full border px-2.5 py-1 text-xs', s.topic ? 'border-primary/40' : 'border-border text-muted-foreground')}>
              {s.topic && <Sparkles className="inline h-3 w-3 mr-1 text-primary" />}
              {s.text}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Tín hiệu nguồn" hint="(trọng số) · * chỉ câu nhắc tên/mã môn">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {SIGNALS.map((x) => (
            <div key={x.key} className="rounded-lg bg-muted/40 px-2.5 py-1.5">
              <p className="text-[10px] text-muted-foreground">{x.label} ({x.weight})</p>
              <p className="text-sm font-bold tabular-nums">{d.signals[x.key]}</p>
            </div>
          ))}
        </div>
        {eventEntries.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {eventEntries.map(([type, n]) => (
              <span key={type} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                {EVENT_LABELS[type] ?? type} · <b className="tabular-nums">{n}</b>
              </span>
            ))}
          </div>
        )}
      </Section>

      <Section title="Hành vi gần nhất" hint="user_events, giữ 90 ngày">
        {d.recentEvents.length === 0 ? (
          <Empty text="Chưa ghi nhận hành vi nào." />
        ) : (
          <ul className="divide-y divide-border/60">
            {d.recentEvents.map((e, i) => (
              <li key={i} className="py-1.5 text-xs flex gap-2">
                <span className="w-28 shrink-0 text-muted-foreground">{EVENT_LABELS[e.type] ?? e.type}</span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{e.target || '—'}</span>
                  {(e.course || e.tags.length > 0) && (
                    <span className="block truncate text-[10px] text-muted-foreground">{[e.course, ...e.tags].filter(Boolean).join(' · ')}</span>
                  )}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{formatRelativeTime(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Câu hỏi PU AI gần nhất">
        {d.aiQuestions.length === 0 ? (
          <Empty text="Chưa hỏi PU AI." />
        ) : (
          <ul className="divide-y divide-border/60">
            {d.aiQuestions.map((q, i) => (
              <li key={i} className="py-1.5 text-xs flex gap-2">
                <span className="flex-1 line-clamp-2">{q.text}</span>
                {q.courses.length > 0 ? (
                  <span className="shrink-0 rounded bg-primary/10 text-primary px-1.5 text-[10px] font-semibold self-start">{q.courses.join(', ')}</span>
                ) : (
                  <span className="shrink-0 text-[10px] text-muted-foreground self-start flex items-center gap-0.5">
                    <AlertTriangle className="h-3 w-3" /> không rõ môn
                  </span>
                )}
                <span className="shrink-0 text-[10px] text-muted-foreground">{formatRelativeTime(q.createdAt)}</span>
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
    <section className="rounded-xl bg-muted/20 p-3">
      <h3 className="mb-2 text-xs font-semibold">
        {title}
        {hint && <span className="ml-1.5 font-normal text-muted-foreground">{hint}</span>}
      </h3>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate">{children}</dd>
    </>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground">{text}</p>
}
