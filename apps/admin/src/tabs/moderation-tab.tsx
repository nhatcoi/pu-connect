import React, { useState } from 'react'
import { CheckCircle2, ExternalLink, Eye, EyeOff, FileText, MessageSquare, Pin, PinOff, Trash2 } from 'lucide-react'
import type { AdminBulkPostAction, AdminCommentRow, AdminPermission, AdminPostRow, AdminReportedPost } from '@pu/schemas'
import { cn, formatNumber, formatRelativeTime, markdownToPlainText, WEB_PORTAL_URL } from '@/lib/api'
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  LoadingRows,
  Menu,
  MenuItem,
  MenuSeparator,
  PageHeader,
  Segmented,
  Tabs,
  Toolbar
} from '@/components/ui'
import {
  BulkBar,
  ListFooter,
  ListSearch,
  ParamSelect,
  SortSelect,
  useBulk,
  useListState,
  usePaged,
  useSelection,
  type ListState,
  type Selection
} from '@/components/list/list-kit'
import { SavedViews } from '@/components/list/saved-views'
import { useHashQuery } from '@/hooks/use-hash-query'

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  exam_leak: 'Lộ đề thi',
  harassment: 'Công kích',
  inaccurate_info: 'Sai lệch',
  other: 'Khác'
}

const POST_TYPE_LABELS: Record<string, string> = {
  general: 'Thảo luận',
  question: 'Hỏi đáp',
  resource_share: 'Chia sẻ tài liệu',
  pbl_recruitment: 'Tuyển thành viên',
  announcement: 'Thông báo'
}

const POST_BULK_MSG: Record<AdminBulkPostAction, string> = {
  hide: 'Đã ẩn',
  unhide: 'Đã hiện lại',
  pin: 'Đã ghim',
  unpin: 'Đã bỏ ghim',
  dismiss: 'Đã bỏ qua báo cáo của'
}

type Tab = 'reports' | 'posts' | 'comments'
const postUrl = (id: string) => `${WEB_PORTAL_URL}/post/${id}`

// Thao tác bài viết (1 hay nhiều) đi qua POST admin/posts/bulk
function usePostBulk(onDone?: () => void) {
  return useBulk<{ ids: string[]; action: AdminBulkPostAction; reason?: string }>(
    '/admin/posts/bulk',
    (n, v) => `${POST_BULK_MSG[v.action]} ${n} bài viết`,
    onDone
  )
}

export function ModerationTab({ permissions, pendingCount }: { permissions: AdminPermission[]; pendingCount?: number }) {
  const [params, set] = useHashQuery()
  const tab = (['reports', 'posts', 'comments'].includes(params.tab) ? params.tab : 'reports') as Tab
  const canWrite = permissions.includes('moderation:write')

  return (
    <>
      <PageHeader
        title="Kiểm duyệt"
        actions={<SavedViews page="moderation" />}
        tabs={
          <Tabs
            value={tab}
            onChange={(t) => set({ tab: t === 'reports' ? undefined : t }, { replace: true })}
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

/* ── Báo cáo ─────────────────────────────────────────────── */

function ReportsSection({ canWrite }: { canWrite: boolean }) {
  const state = useListState({ sort: 'reports' })
  const list = usePaged<AdminReportedPost>('reports', '/admin/reports', state.params, ['status', 'reason', 'q'])
  const rows = list.data?.items ?? []
  const sel = useSelection(
    rows.map((r) => r.postId),
    JSON.stringify(state.params)
  )
  const [hideIds, setHideIds] = useState<string[]>([])
  const act = usePostBulk(() => {
    setHideIds([])
    sel.clear()
  })
  const status = state.params.status === 'resolved' ? 'resolved' : 'pending'

  return (
    <>
      <Toolbar>
        <Segmented
          value={status}
          onChange={(v) => state.set({ status: v === 'pending' ? undefined : v })}
          items={[
            { id: 'pending', label: 'Chờ xử lý' },
            { id: 'resolved', label: 'Đã xử lý' }
          ]}
        />
        <ListSearch state={state} placeholder="Nội dung bài, @tác giả" />
        <ParamSelect state={state} name="reason" all="Mọi lý do" options={Object.entries(REASON_LABELS).map(([value, label]) => ({ value, label }))} className="w-36" />
        <SortSelect
          state={state}
          options={[
            ['reports', 'Nhiều báo cáo nhất'],
            ['recent', 'Báo cáo mới nhất']
          ]}
        />
        <Total n={list.data?.total} unit="bài bị báo cáo" />
      </Toolbar>

      {list.isPending ? (
        <LoadingRows rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={status === 'pending' ? 'Không còn báo cáo nào' : 'Không có báo cáo phù hợp'}
          description={status === 'pending' && !state.params.q && !state.params.reason ? 'Mọi báo cáo đã được xử lý.' : undefined}
        />
      ) : (
        <div className={cn(list.isPlaceholderData && 'opacity-60')}>
          <SelectAllRow sel={sel} canWrite={canWrite} />
          <ul className="divide-y divide-border rounded-b-xl border border-t-0 border-border bg-card">
            {rows.map((r) => {
              const hidden = !!r.hiddenAt
              return (
                <li key={r.postId} className={cn('flex gap-3 p-4', sel.has(r.postId) && 'bg-primary/5')}>
                  {canWrite && <Checkbox className="mt-1" label="Chọn" checked={sel.has(r.postId)} onChange={(on) => sel.toggle(r.postId, on)} />}
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
                    <div className="flex shrink-0 flex-col items-stretch gap-2">
                      {hidden ? (
                        <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ ids: [r.postId], action: 'unhide' })}>
                          <Eye /> Hiện lại
                        </Button>
                      ) : (
                        <>
                          <Button size="sm" variant="danger" disabled={act.isPending} onClick={() => setHideIds([r.postId])}>
                            <EyeOff /> Ẩn bài
                          </Button>
                          {status === 'pending' && (
                            <Button size="sm" variant="ghost" disabled={act.isPending} onClick={() => act.mutate({ ids: [r.postId], action: 'dismiss' })}>
                              Bỏ qua
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <ListFooter state={state} total={list.data?.total ?? 0} />
        </div>
      )}

      <BulkBar count={sel.count} onClear={sel.clear}>
        <Button size="sm" variant="danger-soft" disabled={act.isPending} onClick={() => setHideIds(sel.ids())}>
          <EyeOff /> Ẩn bài
        </Button>
        {status === 'pending' && (
          <Button size="sm" variant="ghost" disabled={act.isPending} onClick={() => act.mutate({ ids: sel.ids(), action: 'dismiss' })}>
            Bỏ qua báo cáo
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={act.isPending} onClick={() => act.mutate({ ids: sel.ids(), action: 'unhide' })}>
          <Eye /> Hiện lại
        </Button>
      </BulkBar>

      <HideDialog ids={hideIds} onClose={() => setHideIds([])} loading={act.isPending} onConfirm={(reason) => act.mutate({ ids: hideIds, action: 'hide', reason })} />
    </>
  )
}

/* ── Bài viết ────────────────────────────────────────────── */

const POST_FILTERS = [
  { id: '', label: 'Tất cả' },
  { id: 'reported', label: 'Bị báo cáo' },
  { id: 'hidden', label: 'Đang ẩn' },
  { id: 'pinned', label: 'Đang ghim' },
  { id: 'qna_unsolved', label: 'Q&A chưa giải' }
]

function PostsSection({ canWrite }: { canWrite: boolean }) {
  const state = useListState({ sort: 'recent' })
  const list = usePaged<AdminPostRow>('posts', '/admin/posts', state.params, ['q', 'filter', 'type'])
  const rows = list.data?.items ?? []
  const sel = useSelection(
    rows.map((r) => r.id),
    JSON.stringify(state.params)
  )
  const [hideIds, setHideIds] = useState<string[]>([])
  const act = usePostBulk(() => {
    setHideIds([])
    sel.clear()
  })

  return (
    <>
      <Toolbar>
        <ListSearch state={state} placeholder="Tìm nội dung (không dấu), @tác giả" />
        <Segmented value={state.params.filter ?? ''} onChange={(v) => state.set({ filter: v })} items={POST_FILTERS} />
        <ParamSelect state={state} name="type" all="Mọi loại bài" options={Object.entries(POST_TYPE_LABELS).map(([value, label]) => ({ value, label }))} className="w-40" />
        <SortSelect
          state={state}
          options={[
            ['recent', 'Mới nhất'],
            ['likes', 'Nhiều lượt thích'],
            ['comments', 'Nhiều bình luận'],
            ['views', 'Nhiều lượt xem'],
            ['reports', 'Nhiều báo cáo']
          ]}
        />
        <Total n={list.data?.total} unit="bài viết" />
      </Toolbar>

      {list.isPending ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <EmptyState icon={FileText} title="Không có bài viết phù hợp" />
      ) : (
        <div className={cn(list.isPlaceholderData && 'opacity-60')}>
          <SelectAllRow sel={sel} canWrite={canWrite} />
          <ul className="divide-y divide-border rounded-b-xl border border-t-0 border-border bg-card">
            {rows.map((p) => (
              <li key={p.id} className={cn('flex gap-3 p-4', sel.has(p.id) && 'bg-primary/5')}>
                {canWrite && <Checkbox className="mt-1" label="Chọn" checked={sel.has(p.id)} onChange={(on) => sel.toggle(p.id, on)} />}
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
                    <Badge>{POST_TYPE_LABELS[p.postType] ?? p.postType}</Badge>
                    {p.courseCode && <Badge className="font-mono">{p.courseCode}</Badge>}
                    {p.communityName && <Badge>{p.communityName}</Badge>}
                  </div>
                  <a href={postUrl(p.id)} target="_blank" rel="noreferrer" className="group block">
                    {p.title && <p className="truncate font-semibold text-foreground group-hover:underline">{p.title}</p>}
                    <p className="line-clamp-2 text-sm text-muted-foreground">{markdownToPlainText(p.content)}</p>
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(p.likesCount)} thích · {formatNumber(p.commentsCount)} bình luận · {formatNumber(p.viewsCount)} xem
                    {p.reportCount > 0 && <span className="font-medium text-warning"> · {p.reportCount} báo cáo</span>}
                  </p>
                </div>
                <Menu>
                  <MenuItem icon={ExternalLink} onSelect={() => window.open(postUrl(p.id), '_blank', 'noopener')}>
                    Mở bài viết
                  </MenuItem>
                  {canWrite && (
                    <>
                      <MenuSeparator />
                      <MenuItem icon={p.isPinned ? PinOff : Pin} onSelect={() => act.mutate({ ids: [p.id], action: p.isPinned ? 'unpin' : 'pin' })}>
                        {p.isPinned ? 'Bỏ ghim' : 'Ghim lên bảng tin'}
                      </MenuItem>
                      {p.hiddenAt ? (
                        <MenuItem icon={Eye} onSelect={() => act.mutate({ ids: [p.id], action: 'unhide' })}>
                          Hiện lại
                        </MenuItem>
                      ) : (
                        <MenuItem icon={EyeOff} danger onSelect={() => setHideIds([p.id])}>
                          Ẩn bài viết
                        </MenuItem>
                      )}
                    </>
                  )}
                </Menu>
              </li>
            ))}
          </ul>
          <ListFooter state={state} total={list.data?.total ?? 0} />
        </div>
      )}

      <BulkBar count={sel.count} onClear={sel.clear}>
        <Button size="sm" variant="ghost" disabled={act.isPending} onClick={() => act.mutate({ ids: sel.ids(), action: 'pin' })}>
          <Pin /> Ghim
        </Button>
        <Button size="sm" variant="ghost" disabled={act.isPending} onClick={() => act.mutate({ ids: sel.ids(), action: 'unpin' })} title="Bỏ ghim">
          <PinOff />
        </Button>
        <Button size="sm" variant="ghost" disabled={act.isPending} onClick={() => act.mutate({ ids: sel.ids(), action: 'unhide' })} title="Hiện lại">
          <Eye />
        </Button>
        <Button size="sm" variant="danger-soft" disabled={act.isPending} onClick={() => setHideIds(sel.ids())}>
          <EyeOff /> Ẩn
        </Button>
      </BulkBar>

      <HideDialog ids={hideIds} onClose={() => setHideIds([])} loading={act.isPending} onConfirm={(reason) => act.mutate({ ids: hideIds, action: 'hide', reason })} />
    </>
  )
}

/* ── Bình luận ───────────────────────────────────────────── */

function CommentsSection({ canWrite }: { canWrite: boolean }) {
  const state = useListState({ sort: 'recent' })
  const list = usePaged<AdminCommentRow>('comments', '/admin/comments', state.params, ['q', 'filter'])
  const rows = list.data?.items ?? []
  const sel = useSelection(
    rows.map((r) => r.id),
    JSON.stringify(state.params)
  )
  const [delIds, setDelIds] = useState<string[]>([])
  const del = useBulk<{ ids: string[]; action: 'delete'; reason?: string }>('/admin/comments/bulk', (n) => `Đã xóa ${n} bình luận`, () => {
    setDelIds([])
    sel.clear()
  })

  return (
    <>
      <Toolbar>
        <ListSearch state={state} placeholder="Nội dung (không dấu), @tác giả" />
        <Segmented
          value={state.params.filter ?? ''}
          onChange={(v) => state.set({ filter: v })}
          items={[
            { id: '', label: 'Tất cả' },
            { id: 'solution', label: 'Lời giải Q&A' }
          ]}
        />
        <SortSelect
          state={state}
          options={[
            ['recent', 'Mới nhất'],
            ['likes', 'Nhiều lượt thích']
          ]}
        />
        <Total n={list.data?.total} unit="bình luận" />
      </Toolbar>

      {list.isPending ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <EmptyState icon={MessageSquare} title="Không có bình luận phù hợp" />
      ) : (
        <div className={cn(list.isPlaceholderData && 'opacity-60')}>
          <SelectAllRow sel={sel} canWrite={canWrite} />
          <ul className="divide-y divide-border rounded-b-xl border border-t-0 border-border bg-card">
            {rows.map((c) => (
              <li key={c.id} className={cn('flex gap-3 p-4', sel.has(c.id) && 'bg-primary/5')}>
                {canWrite && <Checkbox className="mt-1" label="Chọn" checked={sel.has(c.id)} onChange={(on) => sel.toggle(c.id, on)} />}
                <Avatar src={c.author.avatarUrl} name={c.author.displayName} className="hidden sm:inline-flex" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-x-1.5 text-sm">
                    <span className="font-semibold text-foreground">{c.author.displayName}</span>
                    <span className="text-muted-foreground">@{c.author.username}</span>
                    <span className="text-muted-foreground">· {formatRelativeTime(c.createdAt)}</span>
                    {c.isSolution && <Badge tone="success">Lời giải</Badge>}
                    {c.likesCount > 0 && <span className="text-xs text-muted-foreground">· {c.likesCount} thích</span>}
                  </div>
                  <p className="text-sm text-foreground">{markdownToPlainText(c.content)}</p>
                  <a href={postUrl(c.postId)} target="_blank" rel="noreferrer" className="inline-block max-w-full truncate text-xs text-muted-foreground hover:text-primary">
                    trong “{c.postTitle || c.postId.slice(0, 8)}”
                  </a>
                </div>
                {canWrite && (
                  <Button variant="danger-soft" size="icon-sm" title="Xóa bình luận" onClick={() => setDelIds([c.id])}>
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <ListFooter state={state} total={list.data?.total ?? 0} />
        </div>
      )}

      <BulkBar count={sel.count} onClear={sel.clear}>
        <Button size="sm" variant="danger-soft" disabled={del.isPending} onClick={() => setDelIds(sel.ids())}>
          <Trash2 /> Xóa
        </Button>
      </BulkBar>

      <ConfirmDialog
        open={delIds.length > 0}
        onClose={() => setDelIds([])}
        title={delIds.length > 1 ? `Xóa ${delIds.length} bình luận?` : 'Xóa bình luận?'}
        description="Không thể hoàn tác."
        confirmLabel="Xóa"
        withReason
        loading={del.isPending}
        onConfirm={(reason) => del.mutate({ ids: delIds, action: 'delete', reason })}
      />
    </>
  )
}

/* ── Dùng chung ──────────────────────────────────────────── */

function HideDialog({ ids, onClose, onConfirm, loading }: { ids: string[]; onClose: () => void; onConfirm: (reason?: string) => void; loading: boolean }) {
  return (
    <ConfirmDialog
      open={ids.length > 0}
      onClose={onClose}
      title={ids.length > 1 ? `Ẩn ${ids.length} bài viết?` : 'Ẩn bài viết?'}
      description="Gỡ khỏi bảng tin và tìm kiếm; báo cáo đang chờ được đóng."
      confirmLabel="Ẩn bài"
      withReason
      reasonPlaceholder="Lý do (VD: Lộ đề thi, spam)"
      loading={loading}
      onConfirm={onConfirm}
    />
  )
}

// Hàng "chọn cả trang" phía trên danh sách dạng thẻ
function SelectAllRow({ sel, canWrite }: { sel: Selection; canWrite: boolean }) {
  return (
    <div className="flex h-10 items-center gap-3 rounded-t-xl border border-border bg-muted/40 px-4 text-xs font-medium text-muted-foreground">
      {canWrite && <Checkbox label="Chọn cả trang" checked={sel.all} indeterminate={sel.some} onChange={sel.toggleAll} />}
      <span>{sel.some ? `${sel.count} đã chọn` : canWrite ? 'Chọn để thao tác hàng loạt' : 'Danh sách'}</span>
    </div>
  )
}

function Total({ n, unit }: { n?: number; unit: string }) {
  if (n === undefined) return null
  return (
    <span className="ml-auto text-sm tabular-nums text-muted-foreground">
      {formatNumber(n)} {unit}
    </span>
  )
}

