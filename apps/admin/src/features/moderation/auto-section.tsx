import React from 'react'
import { Bot, CheckCircle2, ExternalLink } from 'lucide-react'
import type { AdminModerationEvent } from '@pu/schemas'
import { cn, formatRelativeTime, WEB_PORTAL_URL } from '@/lib/api'
import { Avatar, Badge, Button, EmptyState, LoadingRows, Segmented, Toolbar } from '@/components/ui'
import { ListFooter, ListSearch, ParamSelect, useBulk, useListState, usePaged } from '@/components/list/list-kit'

const ACTION: Record<AdminModerationEvent['action'], { label: string; tone: 'danger' | 'warning' | 'neutral'; hint: string }> = {
  block: { label: 'Đã chặn', tone: 'danger', hint: 'Không đăng được, chỉ còn bản ghi này' },
  hold: { label: 'Ẩn chờ duyệt', tone: 'warning', hint: 'Bài đã lưu nhưng đang ẩn' },
  flag: { label: 'Gắn cờ', tone: 'neutral', hint: 'Vẫn hiển thị, chỉ để admin xem' }
}
const SURFACE = { post: 'Bài viết', comment: 'Bình luận' }
const REASON: Record<string, string> = { profanity: 'Từ cấm', hate: 'Thù ghét', offense: 'Xúc phạm' }

type Resolution = 'confirmed' | 'dismissed'

// Nội dung bị kiểm duyệt tự động chặn hoặc ẩn: admin xem lại, đồng ý hoặc hiện lại nếu hệ thống sai
export function AutoSection({ canWrite }: { canWrite: boolean }) {
  const state = useListState({ sort: 'recent' })
  const list = usePaged<AdminModerationEvent>('moderation-events', '/admin/moderation-events', state.params, ['status', 'action', 'surface', 'q'])
  const rows = list.data?.items ?? []
  const status = state.params.status === 'reviewed' ? 'reviewed' : 'pending'
  const act = useBulk<{ ids: string[]; resolution: Resolution }>(
    '/admin/moderation-events/review',
    (n, v) => (v.resolution === 'confirmed' ? `Đã xác nhận ${n} mục` : `Đã bỏ qua ${n} mục, bài bị ẩn được hiện lại`),
    undefined
  )

  return (
    <>
      <Toolbar>
        <Segmented
          value={status}
          onChange={(v) => state.set({ status: v === 'pending' ? undefined : v })}
          items={[
            { id: 'pending', label: 'Chờ xem' },
            { id: 'reviewed', label: 'Đã xem' }
          ]}
        />
        <ListSearch state={state} placeholder="@username hoặc nội dung" />
        <ParamSelect state={state} name="action" all="Mọi mức" options={Object.entries(ACTION).map(([value, a]) => ({ value, label: a.label }))} className="w-36" />
        <ParamSelect state={state} name="surface" all="Bài + bình luận" options={Object.entries(SURFACE).map(([value, label]) => ({ value, label }))} className="w-36" />
      </Toolbar>

      {list.isPending ? (
        <LoadingRows rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState icon={CheckCircle2} title={status === 'pending' ? 'Chưa có nội dung nào bị bắt' : 'Chưa có mục nào đã xem'} />
      ) : (
        <div className={cn(list.isPlaceholderData && 'opacity-60')}>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {rows.map((e) => {
              const a = ACTION[e.action]
              return (
                <li key={e.id} className="flex gap-3 p-4">
                  <Avatar src={e.user?.avatarUrl ?? null} name={e.user?.displayName ?? '?'} className="hidden sm:inline-flex" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
                      <span className="font-semibold text-foreground">{e.user?.displayName ?? 'Tài khoản đã xóa'}</span>
                      {e.user && <span className="text-muted-foreground">@{e.user.username}</span>}
                      <span className="text-muted-foreground">· {formatRelativeTime(e.createdAt)}</span>
                      <span title={a.hint}>
                        <Badge tone={a.tone}>{a.label}</Badge>
                      </span>
                      <Badge>{SURFACE[e.surface]}</Badge>
                      {e.reason && <Badge>{REASON[e.reason] ?? e.reason}</Badge>}
                      {!e.enforced && <Badge>Chạy thử</Badge>}
                      {e.tier === 2 && e.scores && <Badge>Model: thù ghét {Math.round(e.scores.hate * 100)}%</Badge>}
                    </div>
                    <p className="line-clamp-4 whitespace-pre-wrap break-words rounded-md bg-muted/50 px-3 py-2 text-sm text-foreground">{e.content}</p>
                    {e.matchedTerms.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        Từ khớp:
                        {e.matchedTerms.map((t) => (
                          <Badge key={t} tone="danger">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-stretch gap-2">
                    {e.user && (
                      <a href={`#/users?user=${e.user.id}`} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-accent">
                        <ExternalLink className="size-3.5" /> Mở hồ sơ
                      </a>
                    )}
                    {e.targetType === 'post' && e.targetId && (
                      <a href={`${WEB_PORTAL_URL}/post/${e.targetId}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-accent">
                        <Bot className="size-3.5" /> Xem bài
                      </a>
                    )}
                    {canWrite && status === 'pending' && (
                      <>
                        <Button size="sm" variant="primary" disabled={act.isPending} onClick={() => act.mutate({ ids: [e.id], resolution: 'confirmed' })}>
                          Đúng
                        </Button>
                        <Button size="sm" variant="ghost" disabled={act.isPending} title={e.action === 'hold' ? 'Hệ thống sai: hiện lại bài' : 'Hệ thống sai'} onClick={() => act.mutate({ ids: [e.id], resolution: 'dismissed' })}>
                          {e.action === 'hold' ? 'Sai, hiện lại' : 'Bỏ qua'}
                        </Button>
                      </>
                    )}
                    {status === 'reviewed' && <Badge tone={e.reviewStatus === 'confirmed' ? 'success' : 'neutral'}>{e.reviewStatus === 'confirmed' ? 'Đã xác nhận' : 'Đã bỏ qua'}</Badge>}
                  </div>
                </li>
              )
            })}
          </ul>
          <ListFooter state={state} total={list.data?.total ?? 0} />
        </div>
      )}
    </>
  )
}
