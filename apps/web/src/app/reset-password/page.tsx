'use client'

import React, { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Eye, EyeOff, Loader2, XCircle } from 'lucide-react'
import { PuLogo } from '@/components/brand/pu-logo'
import { Input } from '@/components/ui/input'
import { apiClient } from '@/lib/api-client'
import { useAppStore } from '@/store'

function ResetPasswordContent() {
  const token = useSearchParams().get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [done, setDone] = useState(false)

  if (!token) {
    return (
      <div className="w-full max-w-sm rounded-2xl bg-card p-8 text-center shadow-sm space-y-4">
        <XCircle className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="text-lg font-semibold">Liên kết không hợp lệ</h1>
        <Link href="/forgot-password" className="inline-block text-[13px] font-semibold text-primary hover:underline">
          Yêu cầu liên kết mới
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="w-full max-w-sm rounded-2xl bg-card p-8 text-center shadow-sm space-y-4">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        <h1 className="text-lg font-semibold">Đã đổi mật khẩu</h1>
        <p className="text-[13px] text-muted-foreground">
          Mọi phiên đăng nhập cũ đã bị đăng xuất. Hãy đăng nhập lại bằng mật khẩu mới.
        </p>
        <Link
          href="/"
          className="inline-block rounded-full bg-primary px-6 py-2 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Đăng nhập
        </Link>
      </div>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError('Mật khẩu phải có ít nhất 8 ký tự')
    if (password.length > 72) return setError('Mật khẩu tối đa 72 ký tự')
    if (password !== confirm) return setError('Mật khẩu nhập lại không khớp')
    setError('')
    setIsBusy(true)
    try {
      await apiClient('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) })
      // Phiên hiện tại (nếu có) đã bị hủy trên server ⇒ xóa trạng thái đăng nhập phía client
      useAppStore.getState().logout()
      setDone(true)
    } catch (err: any) {
      setError(err.message || 'Không thể đặt lại mật khẩu')
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-sm space-y-4">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Đặt mật khẩu mới</h1>
        <p className="text-[13px] text-muted-foreground">Chọn mật khẩu mới cho tài khoản của bạn.</p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-[13px] font-medium">
          Mật khẩu mới
        </label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            autoFocus
            placeholder="Ít nhất 8 ký tự"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="confirm" className="text-[13px] font-medium">
          Nhập lại mật khẩu
        </label>
        <Input
          id="confirm"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={isBusy}
        className="inline-flex w-full items-center justify-center rounded-full h-10 bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer"
      >
        {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Đổi mật khẩu'}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-8 px-4">
      <PuLogo markClassName="h-9 w-9" />
      <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin text-primary" />}>
        <ResetPasswordContent />
      </Suspense>
    </div>
  )
}
