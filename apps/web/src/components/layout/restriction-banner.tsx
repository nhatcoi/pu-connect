'use client'

import { ShieldAlert } from 'lucide-react'
import { useAppStore } from '@/store'

// Tài khoản bị hạn chế (chỉ đọc): báo rõ để người dùng biết vì sao không đăng được
export function RestrictionBanner() {
  const user = useAppStore((s) => s.user)
  if (!user?.isRestricted) return null
  const until = user.restrictedUntil ? new Date(user.restrictedUntil).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : null

  return (
    <div role="status" className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-800 dark:text-amber-300">
      <ShieldAlert className="mr-1.5 inline h-4 w-4 -translate-y-px" />
      Tài khoản đang bị hạn chế{until ? ` đến ${until}` : ''}: bạn vẫn xem được nội dung nhưng chưa thể đăng bài, bình luận hay nhắn tin.
    </div>
  )
}
