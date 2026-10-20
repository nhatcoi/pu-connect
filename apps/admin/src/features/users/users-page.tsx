import React, { useEffect, useMemo, useRef, useState } from 'react'
import { BadgeCheck, BadgeX, Download, Gavel, KeyRound, LockOpen, LogOut, Mail, ShieldCheck, SlidersHorizontal, UserCog, Users, X } from 'lucide-react'
import { USER_ROLES, type AdminUserRow, type AdminUserSort, type AdminUserSummary, type SanctionKind } from '@pu/schemas'
import { apiUrl, cn, formatCompact, formatNumber, formatRelativeTime, ROLE_SHORT } from '@/lib/api'
import { useDebounced } from '@/hooks/use-debounced'
import { useHashQuery } from '@/hooks/use-hash-query'
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  EmptyState,
  FilterChip,
  LoadingRows,
  Menu,
  MenuItem,
  MenuLabel,
  PageHeader,
  Pagination,
  ROLE_TONE,
  SearchInput,
  Select,
  SortTh,
  Th
} from '@/components/ui'
import { SavedViews } from '@/components/list/saved-views'
import { UserInsightModal } from '@/components/user-insight-modal'
import { FILTER_OPTIONS, filterValueLabel, SEGMENT_KEYS, SEGMENTS } from './labels'
import { UserActionsMenu, type UserActionHandlers } from './user-actions'
import { UserDrawer } from './user-drawer'
import { SanctionDialog } from './sanction-dialog'
import { FILTER_KEYS, isOnline, toQueryString, useUserActions, useUsersList, useUsersSummary, type FilterKey } from './use-users'

export function UsersPage({ currentUserId }: { currentUserId: string }) {
  const [params, setParams] = useHashQuery()
  const list = useUsersList(params)
  const summary = useUsersSummary()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sanctionTargets, setSanctionTargets] = useState<AdminUserRow[]>([])
  const [sanctionKind, setSanctionKind] = useState<SanctionKind | undefined>()
  const [insightId, setInsightId] = useState<string | null>(null)
  const actions = useUserActions(() => {
    setSanctionTargets([])
    setSelected(new Set())
  })

  const sort = (params.sort as AdminUserSort) || 'created'
  const dir = (params.dir as 'asc' | 'desc') || 'desc'
  const page = Number(params.page) || 1
  const pageSize = Number(params.pageSize) || 25
  const rows = list.data?.items ?? []
  const listKey = toQueryString(params)

  // Đổi bộ lọc / trang ⇒ bỏ chọn
  useEffect(() => setSelected(new Set()), [listKey])

  const handlers: UserActionHandlers = {
    run: (v) => actions.mutate(v),
    onSanction: (users, kind) => {
      setSanctionKind(kind)
      setSanctionTargets(users)
    },
    onInsight: setInsightId,
    onOpen: (id) => setParams({ user: id }, { resetPage: false })
  }

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s)
      if (on) n.add(id)
      else n.delete(id)
      return n
    })
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const selectedRows = rows.filter((r) => selected.has(r.id))

  return (
    <>
      <PageHeader
        title="Người dùng"
        description={summary.data ? `${formatNumber(summary.data.total)} tài khoản · ${formatNumber(summary.data.verified)} đã xác thực` : undefined}
        actions={
          <>
            <SavedViews page="users" />
            <a
              href={apiUrl(`/admin/users/export?${toQueryString(params, FILTER_KEYS)}`)}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent"
            >
              <Download className="size-4" /> Xuất CSV
            </a>
          </>
        }
      />

      <Segments
        summary={summary.data}
        params={params}
        onPick={(patch) => setParams({ ...Object.fromEntries(SEGMENT_KEYS.map((k) => [k, undefined])), ...patch })}
      />

      <Toolbar params={params} setParams={setParams} summary={summary.data} total={list.data?.total} />

      {list.isPending ? (
        <LoadingRows rows={10} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title="Không có tài khoản phù hợp" description="Thử bỏ bớt bộ lọc hoặc đổi từ khóa." />
      ) : (
        <div className={cn('transition-opacity', list.isPlaceholderData && 'opacity-60')}>
          {/* Bảng — từ md trở lên */}
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-left text-xs font-medium text-muted-foreground backdrop-blur">
                  <th className="w-10 pl-4">
                    <Checkbox
                      label="Chọn cả trang"
                      checked={allOnPage}
                      indeterminate={selected.size > 0}
                      onChange={(on) => setSelected(on ? new Set(rows.map((r) => r.id)) : new Set())}
                    />
                  </th>
                  <SortTh id="name" sort={sort} dir={dir} onSort={(s, d) => setParams({ sort: s, dir: d })}>
                    Người dùng
                  </SortTh>
                  <Th>Vai trò</Th>
                  <Th className="hidden xl:table-cell">Khoa</Th>
                  <SortTh
                    id="reputation"
                    sort={sort}
                    dir={dir}
                    onSort={(s, d) => setParams({ sort: s, dir: d })}
                    align="right"
                    className="hidden lg:table-cell"
                  >
                    Uy tín
                  </SortTh>
                  <SortTh id="posts" sort={sort} dir={dir} onSort={(s, d) => setParams({ sort: s, dir: d })} align="right" className="hidden lg:table-cell">
                    Bài viết
                  </SortTh>
                  <SortTh id="reports" sort={sort} dir={dir} onSort={(s, d) => setParams({ sort: s, dir: d })} align="right">
                    Báo cáo
                  </SortTh>
                  <SortTh id="risk" sort={sort} dir={dir} onSort={(s, d) => setParams({ sort: s, dir: d })} align="right">
                    Rủi ro
                  </SortTh>
                  <SortTh id="created" sort={sort} dir={dir} onSort={(s, d) => setParams({ sort: s, dir: d })} className="hidden xl:table-cell">
                    Tham gia
                  </SortTh>
                  <SortTh id="last_seen" sort={sort} dir={dir} onSort={(s, d) => setParams({ sort: s, dir: d })}>
                    Hoạt động
                  </SortTh>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => handlers.onOpen?.(u.id)}
                    className={cn(
                      'cursor-pointer transition-colors hover:bg-accent/60',
                      selected.has(u.id) && 'bg-primary/5',
                      params.user === u.id && 'bg-primary/8'
                    )}
                  >
                    <td className="pl-4" onClick={(e) => e.stopPropagation()}>
                      <Checkbox label={`Chọn ${u.username}`} checked={selected.has(u.id)} onChange={(on) => toggle(u.id, on)} />
                    </td>
                    <td className="max-w-[340px] px-4 py-2.5">
                      <Identity u={u} />
                    </td>
                    <td className="px-4 py-2.5">
                      <RoleStatus u={u} />
                    </td>
                    <td className="hidden px-4 py-2.5 text-muted-foreground xl:table-cell">{u.faculty || '—'}</td>
                    <td className="hidden px-4 py-2.5 text-right tabular-nums lg:table-cell">{formatNumber(u.reputationPoints)}</td>
                    <td className="hidden px-4 py-2.5 text-right tabular-nums lg:table-cell">{formatNumber(u.postCount)}</td>
                    <td className={cn('px-4 py-2.5 text-right tabular-nums', u.reportCount > 0 ? 'font-semibold text-warning' : 'text-muted-foreground')}>
                      {u.reportCount}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <RiskBadge u={u} />
                    </td>
                    <td
                      className="hidden whitespace-nowrap px-4 py-2.5 text-muted-foreground xl:table-cell"
                      title={new Date(u.createdAt).toLocaleString('vi-VN')}
                    >
                      {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <LastSeen at={u.lastSeenAt} />
                    </td>
                    <td className="pr-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <UserActionsMenu user={u} selfId={currentUserId} handlers={handlers} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Thẻ — mobile */}
          <ul className="divide-y divide-border rounded-xl border border-border bg-card md:hidden">
            {rows.map((u) => (
              <li key={u.id} className={cn('flex items-center gap-3 px-3 py-3', selected.has(u.id) && 'bg-primary/5')} onClick={() => handlers.onOpen?.(u.id)}>
                <span onClick={(e) => e.stopPropagation()}>
                  <Checkbox label={`Chọn ${u.username}`} checked={selected.has(u.id)} onChange={(on) => toggle(u.id, on)} />
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Identity u={u} compact />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-12 text-xs text-muted-foreground">
                    <RoleStatus u={u} />
                    <LastSeen at={u.lastSeenAt} />
                    {u.reportCount > 0 && <span className="font-medium text-warning">{u.reportCount} báo cáo</span>}
                    {u.riskScore > 0 && <RiskBadge u={u} />}
                  </div>
                </div>
                <span onClick={(e) => e.stopPropagation()}>
                  <UserActionsMenu user={u} selfId={currentUserId} handlers={handlers} />
                </span>
              </li>
            ))}
          </ul>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={list.data?.total ?? 0}
            onPage={(p) => {
              setParams({ page: p > 1 ? p : undefined }, { resetPage: false })
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            onPageSize={(s) => setParams({ pageSize: s === 25 ? undefined : s })}
          />
        </div>
      )}

      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          includesSelf={selected.has(currentUserId)}
          busy={actions.isPending}
          onClear={() => setSelected(new Set())}
          run={(action, role) => actions.mutate({ ids: [...selected], action, role })}
          onSanction={() => setSanctionTargets(selectedRows)}
        />
      )}

      <SanctionDialog
        users={sanctionTargets}
        presetKind={sanctionKind}
        onClose={() => setSanctionTargets([])}
        loading={actions.isPending}
        onSubmit={(v) => actions.mutate({ ids: sanctionTargets.map((u) => u.id), ...v })}
      />

      <UserDrawer
        userId={params.user || null}
        selfId={currentUserId}
        onClose={() => setParams({ user: undefined }, { resetPage: false })}
        handlers={handlers}
      />
      <UserInsightModal userId={insightId} onClose={() => setInsightId(null)} />
    </>
  )
}

/* ── Thành phần con ─────────────────────────────────────── */

function Identity({ u, compact }: { u: AdminUserRow; compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="relative shrink-0">
        <Avatar src={u.avatarUrl} name={u.displayName} />
        {isOnline(u.lastSeenAt) && <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card bg-green-500" />}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <span className="truncate font-semibold text-foreground">{u.displayName}</span>
          {u.isVerified && <BadgeCheck className="size-4 shrink-0 fill-primary text-card" aria-label="Đã xác thực" />}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          @{u.username}
          {!compact && ` · ${u.email}`}
          {u.studentId && ` · ${u.studentId}`}
        </div>
      </div>
    </div>
  )
}

function RoleStatus({ u }: { u: AdminUserRow }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge tone={ROLE_TONE[u.role]}>{ROLE_SHORT[u.role] ?? u.role}</Badge>
      {u.status === 'suspended' && (
        <span
          title={[u.suspendedReason, u.suspendedUntil ? `đến ${new Date(u.suspendedUntil).toLocaleString('vi-VN')}` : 'vĩnh viễn'].filter(Boolean).join(' · ')}
        >
          <Badge tone="danger" dot>
            Bị khóa{u.suspendedUntil ? ` · ${shortUntil(u.suspendedUntil)}` : ''}
          </Badge>
        </span>
      )}
      {u.isRestricted && (
        <span
          title={[u.restrictedReason, u.restrictedUntil ? `đến ${new Date(u.restrictedUntil).toLocaleString('vi-VN')}` : 'vô thời hạn']
            .filter(Boolean)
            .join(' · ')}
        >
          <Badge tone="warning" dot>
            Hạn chế{u.restrictedUntil ? ` · ${shortUntil(u.restrictedUntil)}` : ''}
          </Badge>
        </span>
      )}
    </span>
  )
}

// Điểm rủi ro 0–100: màu theo mức, rê chuột xem lý do
export function RiskBadge({ u }: { u: AdminUserRow }) {
  if (!u.riskScore) return <span className="text-xs text-muted-foreground">—</span>
  const tone = u.riskScore >= 50 ? 'danger' : u.riskScore >= 25 ? 'warning' : 'neutral'
  return (
    <span title={u.riskFactors.map((f) => `+${f.points} ${f.label}`).join('\n')}>
      <Badge tone={tone} className="tabular-nums">
        {u.riskScore}
      </Badge>
    </span>
  )
}

// Thời hạn còn lại gọn: "còn 3 ngày", "còn 5 giờ"
function shortUntil(iso: string) {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'hết hạn'
  const h = Math.ceil(ms / 3_600_000)
  return h < 48 ? `còn ${h} giờ` : `còn ${Math.ceil(h / 24)} ngày`
}

function LastSeen({ at }: { at: string | null }) {
  if (isOnline(at)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
        <span className="size-1.5 rounded-full bg-current" /> Online
      </span>
    )
  }
  return (
    <span className="text-xs text-muted-foreground" title={at ? new Date(at).toLocaleString('vi-VN') : 'Chưa từng hoạt động'}>
      {at ? formatRelativeTime(at) : 'Chưa vào'}
    </span>
  )
}

// Thẻ phân khúc: bấm để áp bộ lọc định sẵn
function Segments({
  summary,
  params,
  onPick
}: {
  summary?: AdminUserSummary
  params: Record<string, string>
  onPick: (patch: Record<string, string>) => void
}) {
  const current = SEGMENTS.find((s) => SEGMENT_KEYS.every((k) => (params[k] ?? '') === ((s.patch as Record<string, string>)[k] ?? '')))
  return (
    <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
      {SEGMENTS.map((s) => {
        const on = current?.id === s.id
        const value = summary?.[s.stat as keyof AdminUserSummary] as number | undefined
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s.patch as Record<string, string>)}
            className={cn(
              'flex min-w-[124px] shrink-0 flex-col items-start rounded-xl border px-3.5 py-2.5 text-left transition-colors cursor-pointer',
              on ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/40'
            )}
          >
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              {'dot' in s && <span className="size-1.5 rounded-full bg-green-500" />}
              {s.label}
            </span>
            <span
              className={cn(
                'mt-0.5 text-xl font-bold tabular-nums',
                'tone' in s && value ? (s.tone === 'danger' ? 'text-danger' : 'text-warning') : 'text-foreground'
              )}
            >
              {value === undefined ? '—' : formatCompact(value)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function Toolbar({
  params,
  setParams,
  summary,
  total
}: {
  params: Record<string, string>
  setParams: ReturnType<typeof useHashQuery>[1]
  summary?: AdminUserSummary
  total?: number
}) {
  // Ô tìm: state cục bộ, ghi lên URL sau 300ms
  const [q, setQ] = useState(params.q ?? '')
  const debounced = useDebounced(q.trim())
  const inputWrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if ((params.q ?? '') !== debounced) setParams({ q: debounced })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  // Phím "/" để tìm nhanh
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(t.tagName)) {
        e.preventDefault()
        inputWrap.current?.querySelector('input')?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const popoverKeys = ['status', 'risk', 'verified', 'activity', 'joined', 'auth', 'reported'] as const
  const activeChips = FILTER_KEYS.filter((k) => k !== 'q' && params[k])
  const advancedCount = [...popoverKeys, 'faculty' as const].filter((k) => params[k]).length

  const facultyOptions = useMemo(() => summary?.faculties ?? [], [summary])

  return (
    <div className="mb-3 space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div ref={inputWrap} className="min-w-[220px] flex-1 sm:max-w-md">
          <SearchInput value={q} onChange={setQ} placeholder="Tìm tên, @username, email, mã SV  ( / )" />
        </div>
        <Select value={params.role ?? ''} onChange={(e) => setParams({ role: e.target.value })} className="w-40">
          <option value="">Mọi vai trò</option>
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_SHORT[r]}
              {summary?.byRole[r] !== undefined ? ` (${summary.byRole[r]})` : ''}
            </option>
          ))}
        </Select>

        <Menu
          width={320}
          align="start"
          trigger={(p) => (
            <Button {...p}>
              <SlidersHorizontal /> Bộ lọc
              {advancedCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] leading-4 text-primary-foreground">{advancedCount}</span>}
            </Button>
          )}
        >
          <div className="max-h-[70vh] space-y-3.5 overflow-y-auto p-2">
            {popoverKeys.map((k) => {
              const def = FILTER_OPTIONS[k]!
              return (
                <div key={k}>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">{def.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {def.options.map(([v, label]) => {
                      const on = params[k] === v
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setParams({ [k]: on ? undefined : v })}
                          className={cn(
                            'h-7 rounded-full border px-2.5 text-xs transition-colors cursor-pointer',
                            on ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-accent'
                          )}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {facultyOptions.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Khoa</p>
                <Select value={params.faculty ?? ''} onChange={(e) => setParams({ faculty: e.target.value })}>
                  <option value="">Mọi khoa</option>
                  {facultyOptions.map((f) => (
                    <option key={f.faculty} value={f.faculty}>
                      {f.faculty} ({f.count})
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>
        </Menu>

        {total !== undefined && <span className="ml-auto text-sm tabular-nums text-muted-foreground">{formatNumber(total)} kết quả</span>}
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeChips.map((k) => (
            <FilterChip
              key={k}
              label={k === 'role' ? 'Vai trò' : k === 'faculty' ? 'Khoa' : (FILTER_OPTIONS[k as FilterKey]?.label ?? k)}
              value={k === 'role' ? (ROLE_SHORT[params[k]] ?? params[k]) : k === 'faculty' ? params[k] : filterValueLabel(k, params[k])}
              onRemove={() => setParams({ [k]: undefined })}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              setQ('')
              setParams(Object.fromEntries(FILTER_KEYS.map((k) => [k, undefined])))
            }}
            className="px-1.5 text-xs font-medium text-primary hover:underline cursor-pointer"
          >
            Xóa bộ lọc
          </button>
        </div>
      )}
    </div>
  )
}

// Thanh thao tác hàng loạt nổi ở đáy màn hình
function BulkBar({
  count,
  includesSelf,
  busy,
  onClear,
  run,
  onSanction
}: {
  count: number
  includesSelf: boolean
  busy: boolean
  onClear: () => void
  run: (action: 'verify' | 'unverify' | 'unrestrict' | 'unsuspend' | 'revoke_sessions' | 'send_reset' | 'force_reset' | 'set_role', role?: (typeof USER_ROLES)[number]) => void
  onSanction: () => void
}) {
  return (
    <div
      role="toolbar"
      aria-label="Thao tác hàng loạt"
      className="fixed bottom-4 left-1/2 z-30 flex max-w-[calc(100vw-2rem)] items-center gap-1 overflow-x-auto rounded-xl border border-border bg-popover p-1.5 shadow-2xl shadow-black/20 animate-[bar-in_160ms_ease-out] [scrollbar-width:none]"
      style={{ transform: 'translateX(-50%)' }}
    >
      <span className="flex shrink-0 items-center gap-1 pl-2 pr-1 text-sm font-semibold text-foreground">
        <button type="button" onClick={onClear} aria-label="Bỏ chọn" className="rounded p-0.5 text-muted-foreground hover:text-foreground cursor-pointer">
          <X className="size-4" />
        </button>
        {count} đã chọn
      </span>
      <span className="mx-1 h-5 w-px shrink-0 bg-border" />
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => run('verify')}>
        <BadgeCheck /> <span className="hidden sm:inline">Tích xanh</span>
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => run('unverify')} title="Gỡ tích xanh">
        <BadgeX />
      </Button>
      <Menu
        align="start"
        width={200}
        trigger={(p) => (
          <Button size="sm" variant="ghost" disabled={busy} {...p}>
            <UserCog /> <span className="hidden sm:inline">Vai trò</span>
          </Button>
        )}
      >
        <MenuLabel>Đổi vai trò {includesSelf && '(trừ bạn)'}</MenuLabel>
        {USER_ROLES.map((r) => (
          <MenuItem key={r} onSelect={() => run('set_role', r)}>
            {ROLE_SHORT[r]}
          </MenuItem>
        ))}
      </Menu>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => run('revoke_sessions')} title="Đăng xuất mọi thiết bị">
        <LogOut />
      </Button>
      <Menu
        align="start"
        width={230}
        trigger={(p) => (
          <Button size="sm" variant="ghost" disabled={busy} title="Mật khẩu" {...p}>
            <KeyRound />
          </Button>
        )}
      >
        <MenuLabel>Mật khẩu (bỏ qua admin / tài khoản Google)</MenuLabel>
        <MenuItem icon={Mail} onSelect={() => run('send_reset')}>
          Gửi link đặt lại mật khẩu
        </MenuItem>
        <MenuItem icon={KeyRound} onSelect={() => run('force_reset')}>
          Bắt đổi mật khẩu + đăng xuất
        </MenuItem>
      </Menu>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => run('unrestrict')} title="Gỡ hạn chế">
        <ShieldCheck />
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => run('unsuspend')} title="Mở khóa">
        <LockOpen />
      </Button>
      <Button size="sm" variant="danger-soft" disabled={busy} onClick={onSanction}>
        <Gavel /> <span className="hidden sm:inline">Xử phạt</span>
      </Button>
    </div>
  )
}
