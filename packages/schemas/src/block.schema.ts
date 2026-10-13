// Quan hệ chặn giữa người xem và một người khác
// none: không chặn · blocking: mình đã chặn họ · blocked_by: họ đã chặn mình
export type BlockState = 'none' | 'blocking' | 'blocked_by'

export interface BlockedUser {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  blockedAt: string
}
