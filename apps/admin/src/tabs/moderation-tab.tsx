import React, { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ExternalLink, Eye, EyeOff, FileText, MessageSquare, Pin, PinOff, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { AdminCommentRow, AdminPermission, AdminPostRow, AdminReportedPost } from '@pu/schemas'
import { adminApi, cn, formatNumber, formatRelativeTime, markdownToPlainText, WEB_PORTAL_URL } from '@/lib/api'
import { useDebounced } from '@/hooks/use-debounced'
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  List,
  LoadingRows,
  Menu,
  MenuItem,
  MenuSeparator,
  PageHeader,
  SearchInput,
  Segmented,
  Tabs,
  Toolbar
} from '@/components/ui'

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  exam_leak: 'Lộ đề thi',
  harassment: 'Công kích',
  inaccurate_info: 'Sai lệch',
  other: 'Khác'
}

const postUrl = (id: string) => `${WEB_PORTAL_URL}/post/${id}`
const openPost = (id: string) => window.open(postUrl(id), '_blank', 'noopener')

function useAdminAction<V>(fn: (v: V) => Promise<unknown>, success: (v: V) => string, after?: () => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (_d, v) => {
      toast.success(success(v))
      after?.()
      void qc.invalidateQueries({ queryKey: ['admin'] })
    },
    onError: (err: Error) => toast.error(err.message)
  })
}

export function ModerationTab({ permissions, pendingCount }: { permissions: AdminPermission[]; pendingCount?: number }) {
  const [tab, setTab] = useState<'reports' | 'posts' | 'comments'>('reports')
  const canWrite = permissions.includes('moderation:write')

  return (
    <>
      <PageHeader
        title="Kiểm duyệt"
        tabs={
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: 'reports', label: 'Báo cáo', count: pendingCount },
              { id: 'posts', label: 'Bài viết' },
              { id: 'comments', label: 'Bình luận' }
            ]}
          />
        }
      />
      {tab === 'reports' && <ReportsSection canWrite={canWrite} />}
      {tab === 'posts' && <PostsSection canWrite={canWrite} />}
      {tab === 'comments' && <CommentsSection canWrite={canWrite} />}
    </>
  )
}

function ReportsSection({ canWrite }: { canWrite: boolean }) {
  const [status, setStatus] = useState<'pending' | 'resolved'>('pending')
  const [hideTarget, setHideTarget] = useState<string | null>(null)

  const reports = useQuery({
    queryKey: ['admin', 'reports', status],
    queryFn: () => adminApi.get<AdminReportedPost[]>(`/admin/reports?status=${status}`)
  })

  const act = useAdminAction(
    ({ postId, action, reason }: { postId: string; action: 'hide' | 'unhide' | 'dismiss-reports'; reason?: string }) =>
      adminApi.post(`/admin/posts/${postId}/${action}`, reason ? { reason } : {}),
    (v) => (v.action === 'hide' ? 'Đã ẩn bài viết' : v.action === 'unhide' ? 'Đã hiện lại bài viết' : 'Đã bỏ qua báo cáo'),
    () => setHideTarget(null)
  )

  return (
    <>
      <Toolbar>
        <Segmented
          value={status}
          onChange={setStatus}
          items={[
            { id: 'pending', label: 'Chờ xử lý' },
            { id: 'resolved', label: 'Đã xử lý' }
          ]}
        />
      </Toolbar>

      {reports.isPending ? (
        <LoadingRows rows={4} />
      ) : !reports.data?.length ? (
        <EmptyState
          icon={CheckCircle2}
          title={status === 'pending' ? 'Không còn báo cáo nào' : 'Chưa có báo cáo đã xử lý'}
          description={status === 'pending' ? 'Mọi báo cáo đã được xử lý.' : undefined}
        />
      ) : (
        <List>
          {reports.data.map((r) => {
            const hidden = !!r.hiddenAt
            const busy = act.isPending && act.variables?.postId === r.postId
            return (
              <article key={r.postId} className="flex flex-col gap-3 p-4 sm:flex-row sm:gap-4">
                <Avatar src={r.author.avatarUrl} name={r.author.displayName} className="hidden sm:inline-flex" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-x-1.5 text-sm">
                    <span className="font-semibold text-foreground">{r.author.displayName}</span>
                    <span className="text-muted-foreground">@{r.author.username}</span>
                    <span className="text-muted-foreground">· {formatRelativeTime(r.lastReportedAt)}</span>
                    {r.author.status === 'suspended' && <Badge tone="danger">Tác giả bị khóa</Badge>}
                  </div>
                  <a href={postUrl(r.postId)} target="_blank" rel="noreferrer" className="group block">
                    {r.title && <p className="font-semibold text-foreground group-hover:underline">{r.title}</p>}
                    <p className="line-clamp-2 text-sm text-muted-foreground">{markdownToPlainText(r.content)}</p>
                  </a>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="warning">{r.reportCount} báo cáo</Badge>
                    {r.reasons.map((x) => (
                      <Badge key={x.reason}>
                        {REASON_LABELS[x.reason] || x.reason} · {x.count}
                      </Badge>
                    ))}
                    {hidden && <Badge tone="danger">Đã ẩn</Badge>}
                  </div>
                  {r.details.length > 0 && (
                    <ul className="space-y-1 border-l-2 border-border pl-3 text-xs text-muted-foreground">
                      {r.details.slice(0, 3).map((d, i) => (
                        <li key={i} className="line-clamp-1">
                          “{d}”
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {canWrite && (
                  <div className="flex shrink-0 items-start gap-2 sm:flex-col sm:items-stretch">
                    {hidden ? (
                      <Button size="sm" loading={busy} onClick={() => act.mutate({ postId: r.postId, action: 'unhide' })}>
                        <Eye /> Hiện lại
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" variant="danger" disabled={busy} onClick={() => setHideTarget(r.postId)}>
                          <EyeOff /> Ẩn bài
                        </Button>
                        {r.reportCount > 0 && (
                          <Button size="sm" variant="ghost" loading={busy} onClick={() => act.mutate({ postId: r.postId, action: 'dismiss-reports' })}>
                            Bỏ qua
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </List>
      )}

      <ConfirmDialog
        open={!!hideTarget}
        onClose={() => setHideTarget(null)}
        title="Ẩn bài viết?"
        description="Bài viết bị gỡ khỏi bảng tin và tìm kiếm."
        confirmLabel="Ẩn bài"
        withReason
        reasonPlaceholder="Lý do (VD: Lộ đề thi, spam)"
        loading={act.isPending}
        onConfirm={(reason) => hideTarget && act.mutate({ postId: hideTarget, action: 'hide', reason })}
      />
    </>
  )
}

type PostFilter = 'all' | 'pinned' | 'hidden' | 'qna_unsolved'

function PostsSection({ canWrite }: { canWrite: boolean }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<PostFilter>('all')
  const query = useDebounced(q.trim())

  const posts = useQuery({
    queryKey: ['admin', 'posts', query, filter],
    queryFn: () => {
      const p = new URLSearchParams()
      if (query) p.set('q', query)
      if (filter !== 'all') p.set('filter', filter)
      return adminApi.get<AdminPostRow[]>(`/admin/posts?${p.toString()}`)
    },
    placeholderData: keepPreviousData
  })

  const pin = useAdminAction(
    ({ id, isPinned }: { id: string; isPinned: boolean }) => adminApi.post(`/admin/posts/${id}/pin`, { isPinned }),
    (v) => (v.isPinned ? 'Đã ghim bài viết' : 'Đã bỏ ghim')
  )
  const hide = useAdminAction(
    ({ id, hide }: { id: string; hide: boolean }) =>
      adminApi.post(`/admin/posts/${id}/${hide ? 'hide' : 'unhide'}`, hide ? { reason: 'Ẩn bởi kiểm duyệt viên' } : {}),
    (v) => (v.hide ? 'Đã ẩn bài viết' : 'Đã hiện lại bài viết')
  )

  return (
    <>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Tiêu đề, nội dung, @username" className="min-w-[220px] flex-1 sm:max-w-sm" />
        <Segmented
          value={filter}
          onChange={setFilter}
          items={[
            { id: 'all', label: 'Tất cả' },
            { id: 'pinned', label: 'Đang ghim' },
            { id: 'hidden', label: 'Đang ẩn' },
            { id: 'qna_unsolved', label: 'Q&A chưa giải' }
          ]}
        />
      </Toolbar>

      {posts.isPending ? (
        <LoadingRows />
      ) : !posts.data?.length ? (
        <EmptyState icon={FileText} title="Không có bài viết phù hợp" />
      ) : (
        <List className={cn(posts.isPlaceholderData && 'opacity-60')}>
          {posts.data.map((p) => (
            <div key={p.id} className="flex gap-3 p-4">
              <Avatar src={p.author.avatarUrl} name={p.author.displayName} className="hidden sm:inline-flex" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
                  <span className="font-semibold text-foreground">{p.author.displayName}</span>
                  <span className="text-muted-foreground">· {formatRelativeTime(p.createdAt)}</span>
                  {p.isPinned && (
                    <Badge tone="primary">
                      <Pin /> Ghim
                    </Badge>
                  )}
                  {p.hiddenAt && <Badge tone="danger">Đang ẩn</Badge>}
                  {p.courseCode && <Badge className="font-mono">{p.courseCode}</Badge>}
                  {p.communityName && <Badge>{p.communityName}</Badge>}
                </div>
                {p.title && <p className="truncate font-semibold text-foreground">{p.title}</p>}
                <p className="line-clamp-2 text-sm text-muted-foreground">{markdownToPlainText(p.content)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(p.likesCount)} thích · {formatNumber(p.commentsCount)} bình luận · {formatNumber(p.viewsCount)} xem
                  {p.reportCount > 0 && <span className="font-medium text-warning"> · {p.reportCount} báo cáo</span>}
                </p>
              </div>
              <Menu>
                <MenuItem icon={ExternalLink} onSelect={() => openPost(p.id)}>
                  Mở bài viết
                </MenuItem>
                {canWrite && (
                  <>
                    <MenuSeparator />
                    <MenuItem icon={p.isPinned ? PinOff : Pin} onSelect={() => pin.mutate({ id: p.id, isPinned: !p.isPinned })}>
                      {p.isPinned ? 'Bỏ ghim' : 'Ghim lên bảng tin'}
                    </MenuItem>
                    <MenuItem icon={p.hiddenAt ? Eye : EyeOff} danger={!p.hiddenAt} onSelect={() => hide.mutate({ id: p.id, hide: !p.hiddenAt })}>
                      {p.hiddenAt ? 'Hiện lại' : 'Ẩn bài viết'}
                    </MenuItem>
                  </>
                )}
              </Menu>
            </div>
          ))}
        </List>
      )}
    </>
  )
}

function CommentsSection({ canWrite }: { canWrite: boolean }) {
  const [q, setQ] = useState('')
  const [delTarget, setDelTarget] = useState<string | null>(null)
  const query = useDebounced(q.trim())

  const comments = useQuery({
    queryKey: ['admin', 'comments', query],
    queryFn: () => adminApi.get<AdminCommentRow[]>(`/admin/comments?q=${encodeURIComponent(query)}`),
    placeholderData: keepPreviousData
  })

  const del = useAdminAction(
    ({ id, reason }: { id: string; reason?: string }) => adminApi.delete(`/admin/comments/${id}`, { reason: reason || 'Vi phạm tiêu chuẩn cộng đồng' }),
    () => 'Đã xóa bình luận',
    () => setDelTarget(null)
  )

  return (
    <>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Nội dung, @username" className="min-w-[220px] flex-1 sm:max-w-sm" />
      </Toolbar>

      {comments.isPending ? (
        <LoadingRows />
      ) : !comments.data?.length ? (
        <EmptyState icon={MessageSquare} title="Không có bình luận phù hợp" />
      ) : (
        <List className={cn(comments.isPlaceholderData && 'opacity-60')}>
          {comments.data.map((c) => (
            <div key={c.id} className="flex gap-3 p-4">
              <Avatar src={c.author.avatarUrl} name={c.author.displayName} className="hidden sm:inline-flex" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-x-1.5 text-sm">
                  <span className="font-semibold text-foreground">{c.author.displayName}</span>
                  <span className="text-muted-foreground">· {formatRelativeTime(c.createdAt)}</span>
                  {c.isSolution && <Badge tone="success">Lời giải</Badge>}
                </div>
                <p className="text-sm text-foreground">{markdownToPlainText(c.content)}</p>
                <a href={postUrl(c.postId)} target="_blank" rel="noreferrer" className="inline-block max-w-full truncate text-xs text-muted-foreground hover:text-primary">
                  trong “{c.postTitle || c.postId.slice(0, 8)}”
                </a>
              </div>
              {canWrite && (
                <Button variant="danger-soft" size="icon-sm" title="Xóa bình luận" onClick={() => setDelTarget(c.id)}>
                  <Trash2 />
                </Button>
              )}
            </div>
          ))}
        </List>
      )}

      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        title="Xóa bình luận?"
        description="Không thể hoàn tác."
        confirmLabel="Xóa"
        withReason
        loading={del.isPending}
        onConfirm={(reason) => delTarget && del.mutate({ id: delTarget, reason })}
      />
    </>
  )
}
