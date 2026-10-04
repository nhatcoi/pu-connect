'use client'

import React, { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react'
import { PuLogo } from '@/components/brand/pu-logo'
import { Input } from '@/components/ui/input'
import { apiClient } from '@/lib/api-client'

function ForgotPasswordContent() {
  const [email, setEmail] = useState(useSearchParams().get('email') || '')
  const [error, setError] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = email.trim()
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      setError('Email không hợp lệ')
      return
    }
    setError('')
    setIsBusy(true)
    try {
      await apiClient('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: value }) })
      setSent(true)
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại')
    } finally {
      setIsBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="w-full max-w-sm rounded-2xl bg-card p-8 text-center shadow-sm space-y-4">
        <MailCheck className="mx-auto h-10 w-10 text-primary" />
        <h1 className="text-lg font-semibold">Kiểm tra email của bạn</h1>
        <p className="text-[13px] text-muted-foreground">
          Nếu <b className="text-foreground">{email.trim()}</b> có tài khoản, chúng tôi đã gửi liên kết đặt lại mật khẩu
          (hết hạn sau 30 phút). Nhớ xem cả mục thư rác.
        </p>
        <Link href="/" className="inline-block text-[13px] font-semibold text-primary hover:underline">
          Quay lại đăng nhập
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-sm space-y-4">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Quên mật khẩu</h1>
        <p className="text-[13px] text-muted-foreground">
          Nhập email tài khoản, chúng tôi sẽ gửi liên kết để đặt mật khẩu mới.
        </p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-[13px] font-medium">
          Email
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="ten@phenikaa-uni.edu.vn"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!error}
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
        {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gửi liên kết đặt lại'}
      </button>
      <Link href="/" className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Quay lại đăng nhập
      </Link>
    </form>
  )
}

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-8 px-4">
      <PuLogo markClassName="h-9 w-9" />
      <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin text-primary" />}>
        <ForgotPasswordContent />
      </Suspense>
    </div>
  )
}
