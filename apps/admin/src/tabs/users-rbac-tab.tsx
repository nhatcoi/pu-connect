import React, { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, BadgeCheck, BadgeX, Check, Lock, LockOpen, LogOut, Minus, Users } from 'lucide-react'
import { toast } from 'sonner'
import {
  ADMIN_PERMISSIONS,
  ADMIN_PERMISSION_META,
  ADMIN_ROLE_LABELS,
  ROLE_PERMISSIONS,
  USER_ROLES,
  type AdminPermission,
  type AdminUserRole,
  type AdminUserRow
} from '@pu/schemas'
import { adminApi, cn, formatNumber, formatRelativeTime, ROLE_SHORT } from '@/lib/api'
import { useDebounced } from '@/hooks/use-debounced'
import {
  Badge,
  ConfirmDialog,
  EmptyState,
  LoadingRows,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  PageHeader,
  ROLE_TONE,
  SearchInput,
  Segmented,
  Select,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Toolbar,
  Tr,
  Tabs,
  UserCell
} from '@/components/ui'
import { UserInsightModal } from '@/components/user-insight-modal'

interface UsersRbacTabProps {
  currentUserId: string
  permissions: AdminPermission[]
}

export function UsersRbacTab({ currentUserId, permissions }: UsersRbacTabProps) {
  const [tab, setTab] = useState<'users' | 'roles'>('users')

  return (
    <>
      <PageHeader
        title="Người dùng"
        tabs={
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: 'users', label: 'Tài khoản' },
              { id: 'roles', label: 'Vai trò & quyền' }
            ]}
          />
        }
      />
      {tab === 'users' ? <UsersSection currentUserId={currentUserId} permissions={permissions} /> : <RolesSection mine={permissions} />}
    </>
  )
}

function UsersSection({ currentUserId, permissions }: UsersRbacTabProps) {
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState<'all' | 'suspended'>('all')
  const [insightId, setInsightId] = useState<string | null>(null)
  const [suspendTarget, setSuspendTarget] = useState<AdminUserRow | null>(null)
  const query = useDebounced(q.trim())
  const qc = useQueryClient()

  const can = {
    suspend: permissions.includes('users:suspend'),
    role: permissions.includes('users:role'),
    verify: permissions.includes('users:verify'),
    insight: permissions.includes('users:insight')
  }

  const users = useQuery({
    queryKey: ['admin', 'users', query, role, status],
    queryFn: () => {
      const p = new URLSearchParams()
      if (query) p.set('q', query)
      if (role) p.set('role', role)
      if (status === 'suspended') p.set('status', 'suspended')
      return adminApi.get<AdminUserRow[]>(`/admin/users?${p.toString()}`)
    },
    placeholderData: keepPreviousData
  })

  const onDone = (msg: string) => {
    toast.success(msg)
    void qc.invalidateQueries({ queryKey: ['admin'] })
  }
  const onError = (err: Error) => toast.error(err.message)

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: AdminUserRole }) => adminApi.patch(`/admin/users/${id}/role`, { role }),
    onSuccess: (_d, v) => onDone(`Đã đổi vai trò thành ${ROLE_SHORT[v.role]}`),
    onError
  })
  const verify = useMutation({
    mutationFn: ({ id, isVerified }: { id: string; isVerified: boolean }) => adminApi.patch(`/admin/users/${id}/verify`, { isVerified }),
    onSuccess: (_d, v) => onDone(v.isVerified ? 'Đã cấp tích xanh' : 'Đã gỡ tích xanh'),
    onError
  })
  const suspend = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: 'suspend' | 'unsuspend'; reason?: string }) =>
      adminApi.post(`/admin/users/${id}/${action}`, reason ? { reason } : {}),
    onSuccess: (_d, v) => {
      setSuspendTarget(null)
      onDone(v.action === 'suspend' ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản')
    },
    onError
  })
  const revoke = useMutation({
    mutationFn: (id: string) => adminApi.post<{ revokedCount: number }>(`/admin/users/${id}/revoke-sessions`),
    onSuccess: (res) => toast.success(`Đã đăng xuất ${res.revokedCount} phiên`),
    onError
  })

  const hasActions = can.role || can.verify || can.insight || can.suspend

  return (
    <>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Tên, username, email, mã SV" className="min-w-[220px] flex-1 sm:max-w-sm" />
        <Select value={role} onChange={(e) => setRole(e.target.value)} className="w-40">
          <option value="">Mọi vai trò</option>
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_SHORT[r]}
            </option>
          ))}
        </Select>
        <Segmented
          value={status}
          onChange={setStatus}
          items={[
            { id: 'all', label: 'Tất cả' },
            { id: 'suspended', label: 'Bị khóa' }
          ]}
        />
        {users.data && <span className="ml-auto text-xs text-muted-foreground">{users.data.length} tài khoản</span>}
      </Toolbar>

      {users.isPending ? (
        <LoadingRows rows={8} />
      ) : !users.data?.length ? (
        <EmptyState icon={Users} title="Không có tài khoản phù hợp" />
      ) : (
        <Table className={cn(users.isPlaceholderData && 'opacity-60')}>
          <THead>
            <Th>Người dùng</Th>
            <Th>Vai trò</Th>
            <Th className="hidden text-right lg:table-cell">Uy tín</Th>
            <Th className="hidden text-right lg:table-cell">Bài viết</Th>
            <Th className="hidden text-right md:table-cell">Báo cáo</Th>
            <Th className="hidden sm:table-cell">Hoạt động</Th>
            {hasActions && <Th className="w-12" />}
          </THead>
          <TBody>
            {users.data.map((u) => {
              const self = u.id === currentUserId
              const suspended = u.status === 'suspended'
              return (
                <Tr key={u.id} onClick={can.insight ? () => setInsightId(u.id) : undefined}>
                  <Td className="max-w-[320px]">
                    <UserCell
                      name={u.displayName}
                      avatarUrl={u.avatarUrl}
                      verified={u.isVerified}
                      sub={`@${u.username}${u.studentId ? ` · ${u.studentId}` : ''}`}
                    />
                  </Td>
                  <Td>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge tone={ROLE_TONE[u.role]}>{ROLE_SHORT[u.role] ?? u.role}</Badge>
                      {suspended && (
                        <span title={u.suspendedReason ?? undefined}>
                          <Badge tone="danger" dot>
                            Bị khóa
                          </Badge>
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td className="hidden text-right tabular-nums lg:table-cell">{formatNumber(u.reputationPoints)}</Td>
                  <Td className="hidden text-right tabular-nums lg:table-cell">{formatNumber(u.postCount)}</Td>
                  <Td className={cn('hidden text-right tabular-nums md:table-cell', u.reportCount > 0 ? 'font-semibold text-warning' : 'text-muted-foreground')}>
                    {u.reportCount}
                  </Td>
                  <Td className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">{formatRelativeTime(u.lastSeenAt)}</Td>
                  {hasActions && (
                    <Td className="text-right">
                      <Menu width={230}>
                        {can.insight && (
                          <MenuItem icon={Activity} onSelect={() => setInsightId(u.id)}>
                            Xem insight
                          </MenuItem>
                        )}
                        {can.verify && (
                          <MenuItem
                            icon={u.isVerified ? BadgeX : BadgeCheck}
                            onSelect={() => verify.mutate({ id: u.id, isVerified: !u.isVerified })}
                          >
                            {u.isVerified ? 'Gỡ tích xanh' : 'Cấp tích xanh'}
                          </MenuItem>
                        )}
                        {can.role && !self && (
                          <>
                            <MenuSeparator />
                            <MenuLabel>Đổi vai trò</MenuLabel>
                            {USER_ROLES.map((r) => (
                              <MenuItem
                                key={r}
                                checked={u.role === r}
                                onSelect={() => u.role !== r && changeRole.mutate({ id: u.id, role: r })}
                              >
                                {ROLE_SHORT[r]}
                              </MenuItem>
                            ))}
                          </>
                        )}
                        {can.suspend && !self && (
                          <>
                            <MenuSeparator />
                            <MenuItem icon={LogOut} onSelect={() => revoke.mutate(u.id)}>
                              Đăng xuất mọi thiết bị
                            </MenuItem>
                            {u.role !== 'admin' &&
                              (suspended ? (
                                <MenuItem icon={LockOpen} onSelect={() => suspend.mutate({ id: u.id, action: 'unsuspend' })}>
                                  Mở khóa tài khoản
                                </MenuItem>
                              ) : (
                                <MenuItem icon={Lock} danger onSelect={() => setSuspendTarget(u)}>
                                  Khóa tài khoản
                                </MenuItem>
                              ))}
                          </>
                        )}
                      </Menu>
                    </Td>
                  )}
                </Tr>
              )
            })}
          </TBody>
        </Table>
      )}

      <ConfirmDialog
        open={!!suspendTarget}
        onClose={() => setSuspendTarget(null)}
        title={`Khóa @${suspendTarget?.username ?? ''}?`}
        description="Tài khoản bị đăng xuất khỏi mọi thiết bị ngay lập tức."
        confirmLabel="Khóa tài khoản"
        withReason
        reasonPlaceholder="Lý do khóa"
        loading={suspend.isPending}
        onConfirm={(reason) => suspendTarget && suspend.mutate({ id: suspendTarget.id, action: 'suspend', reason })}
      />
      <UserInsightModal userId={insightId} onClose={() => setInsightId(null)} />
    </>
  )
}

const MATRIX_ROLES = ['admin', 'lecturer', 'ta'] as const

function RolesSection({ mine }: { mine: AdminPermission[] }) {
  // Gom quyền theo phân hệ
  const groups = ADMIN_PERMISSIONS.reduce<Record<string, AdminPermission[]>>((acc, p) => {
    const g = ADMIN_PERMISSION_META[p].group
    ;(acc[g] ??= []).push(p)
    return acc
  }, {})

  return (
    <Table>
      <THead>
        <Th>Quyền</Th>
        {MATRIX_ROLES.map((r) => (
          <Th key={r} className="w-32 text-center">
            <span title={ADMIN_ROLE_LABELS[r].description} className="inline-flex flex-col items-center gap-0.5">
              <span className="text-foreground">{ROLE_SHORT[r]}</span>
              <span className="text-[11px] font-normal">{ROLE_PERMISSIONS[r].length} quyền</span>
            </span>
          </Th>
        ))}
      </THead>
      <TBody>
        {Object.entries(groups).map(([group, perms]) => (
          <React.Fragment key={group}>
            <tr className="bg-muted/30">
              <td colSpan={MATRIX_ROLES.length + 1} className="px-4 py-2 text-xs font-semibold text-muted-foreground">
                {group.replace(' & RBAC', '')}
              </td>
            </tr>
            {perms.map((perm) => (
              <Tr key={perm}>
                <Td>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground">{ADMIN_PERMISSION_META[perm].label}</span>
                    {mine.includes(perm) && <Badge tone="primary">Bạn có</Badge>}
                  </div>
                  <code className="font-mono text-[11px] text-muted-foreground">{perm}</code>
                </Td>
                {MATRIX_ROLES.map((r) => (
                  <Td key={r} className="text-center">
                    {ROLE_PERMISSIONS[r].includes(perm) ? (
                      <Check className="mx-auto size-4 text-success" />
                    ) : (
                      <Minus className="mx-auto size-4 text-muted-foreground/40" />
                    )}
                  </Td>
                ))}
              </Tr>
            ))}
          </React.Fragment>
        ))}
      </TBody>
    </Table>
  )
}
