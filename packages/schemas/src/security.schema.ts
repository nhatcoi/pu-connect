// ── Nhật ký bảo mật tài khoản & thiết bị đăng nhập ──

export type SecurityEventType =
  | 'login'
  | 'login_failed'
  | 'login_blocked'
  | 'logout'
  | 'register'
  | 'password_reset'
  | 'password_reset_requested'
  | 'email_verified'
  | 'session_revoked'

export interface SecurityEvent {
  id: string
  event: SecurityEventType
  success: boolean
  method: 'password' | 'google' | null
  ip: string | null
  device: string | null
  createdAt: string
}

// Phiên đăng nhập đang mở (id = băm sid, không lộ sid thật)
export interface LoginSession {
  id: string
  device: string
  ip: string | null
  method: 'password' | 'google' | null
  createdAt: string | null
  lastActiveAt: string
  current: boolean
}

// ── Admin: điểm rủi ro & tài khoản liên quan ──

export interface RiskFactor {
  key: string
  label: string
  points: number
}

// Tài khoản dùng chung IP (dấu hiệu tài khoản clone)
export interface LinkedAccount {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  status: string
  sharedIps: number
  lastSeenTogetherAt: string
}

export interface AdminUserSecurity {
  events: SecurityEvent[]
  ips: { ip: string; count: number; lastAt: string; accounts: number }[]
  devices: { device: string; count: number; lastAt: string }[]
  linkedAccounts: LinkedAccount[]
  failedLogins24h: number
}

// ── View đã lưu (bộ lọc hay dùng) ──

export interface AdminSavedView {
  id: string
  page: string
  name: string
  query: string
  shared: boolean
  mine: boolean
  owner: string | null
}
