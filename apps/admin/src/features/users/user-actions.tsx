import React from 'react'
import { Activity, BadgeCheck, BadgeX, ExternalLink, Lock, LockOpen, LogOut, PanelRight } from 'lucide-react'
import { USER_ROLES, type AdminUserRow } from '@pu/schemas'
import { ROLE_SHORT, WEB_PORTAL_URL } from '@/lib/api'
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui'
import type { BulkVars } from './use-users'

export interface UserActionHandlers {
  run: (v: BulkVars) => void
  onSuspend: (users: AdminUserRow[]) => void
  onInsight?: (id: string) => void
  onOpen?: (id: string) => void
}

// Menu ⋯ của 1 người dùng
export function UserActionsMenu({
  user: u,
  selfId,
  handlers,
  trigger
}: {
  user: AdminUserRow
  selfId: string
  handlers: UserActionHandlers
  trigger?: React.ComponentProps<typeof Menu>['trigger']
}) {
  const self = u.id === selfId
  const suspended = u.status === 'suspended'
  const { run, onSuspend, onInsight, onOpen } = handlers

  return (
    <Menu width={232} trigger={trigger}>
      {onOpen && (
        <MenuItem icon={PanelRight} onSelect={() => onOpen(u.id)}>
          Xem hồ sơ
        </MenuItem>
      )}
      <MenuItem icon={ExternalLink} onSelect={() => window.open(`${WEB_PORTAL_URL}/${u.username}`, '_blank', 'noopener')}>
        Mở trên PU Connector
      </MenuItem>
      {onInsight && (
        <MenuItem icon={Activity} onSelect={() => onInsight(u.id)}>
          Dữ liệu cá nhân hóa
        </MenuItem>
      )}
      <MenuSeparator />
      <MenuItem icon={u.isVerified ? BadgeX : BadgeCheck} onSelect={() => run({ ids: [u.id], action: u.isVerified ? 'unverify' : 'verify' })}>
        {u.isVerified ? 'Gỡ tích xanh' : 'Cấp tích xanh'}
      </MenuItem>
      {!self && (
        <>
          <MenuSeparator />
          <MenuLabel>Vai trò</MenuLabel>
          {USER_ROLES.map((r) => (
            <MenuItem key={r} checked={u.role === r} onSelect={() => u.role !== r && run({ ids: [u.id], action: 'set_role', role: r })}>
              {ROLE_SHORT[r]}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem icon={LogOut} onSelect={() => run({ ids: [u.id], action: 'revoke_sessions' })}>
            Đăng xuất mọi thiết bị
          </MenuItem>
          {u.role !== 'admin' &&
            (suspended ? (
              <MenuItem icon={LockOpen} onSelect={() => run({ ids: [u.id], action: 'unsuspend' })}>
                Mở khóa
              </MenuItem>
            ) : (
              <MenuItem icon={Lock} danger onSelect={() => onSuspend([u])}>
                Khóa tài khoản
              </MenuItem>
            ))}
        </>
      )}
    </Menu>
  )
}
