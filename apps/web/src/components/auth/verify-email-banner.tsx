'use client'

import React, { useState } from 'react'
import { MailWarning } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { apiClient, errorMessage } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { SHELL_WIDTH } from '@/lib/layout'

// Nhắc xác thực email (chỉ hiện khi đã đăng nhập mà email chưa xác thực)
export function VerifyEmailBanner() {
  const user = useAppStore((state) => state.user)
  const [isSending, setIsSending] = useState(false)

  if (!user || user.isEmailVerified !== false) return null

  const resend = async () => {
    setIsSending(true)
    try {
      await apiClient('/auth/resend-verification', { method: 'POST' })
      toast.success(`Đã gửi email xác thực tới ${user.email}`)
    } catch (err) {
      toast.error(errorMessage(err, 'Không thể gửi email, vui lòng thử lại'))
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div role="status" className="w-full bg-brand-orange/10 text-[13px]">
      <div className={cn('mx-auto flex items-center justify-center gap-2 px-4 py-2 text-center', SHELL_WIDTH)}>
        <MailWarning className="h-4 w-4 shrink-0 text-brand-orange" />
        <span className="text-foreground">
          Xác thực email <b>{user.email}</b> để hoàn tất tài khoản.
        </span>
        <button
          type="button"
          onClick={resend}
          disabled={isSending}
          className="font-semibold text-primary hover:underline disabled:opacity-60 cursor-pointer"
        >
          {isSending ? 'Đang gửi…' : 'Gửi lại email'}
        </button>
      </div>
    </div>
  )
}
