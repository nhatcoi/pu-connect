'use client'

import React, { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import type { UserProfile } from '@pu/schemas'
import { PuLogo } from '@/components/brand/pu-logo'
import { apiClient } from '@/lib/api-client'
import { useAppStore } from '@/store'

type Status = 'loading' | 'success' | 'error'

function VerifyEmailContent() {
  const token = useSearchParams().get('token') || ''
  const setUser = useAppStore((state) => state.setUser)
  const currentUser = useAppStore((state) => state.user)
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('')
  const started = useRef(false) // tránh gọi 2 lần (React Strict Mode)

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (!token) {
      setStatus('error')
      setMessage('Liên kết xác thực không hợp lệ.')
      return
    }
    apiClient<{ success: boolean; data: UserProfile }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token })
    })
      .then((res) => {
        setStatus('success')
        // Cập nhật phiên hiện tại nếu đúng tài khoản đang đăng nhập
        if (currentUser && res.data && currentUser.id === res.data.id) setUser(res.data)
      })
      .catch((err: any) => {
        setStatus('error')
        setMessage(err.message || 'Không thể xác thực email.')
      })
  }, [token, currentUser, setUser])

  return (
    <div className="w-full max-w-sm rounded-2xl bg-card p-8 text-center shadow-sm space-y-4">
      {status === 'loading' && (
        <>
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Đang xác thực email…</p>
        </>
      )}
      {status === 'success' && (
        <>
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <h1 className="text-lg font-semibold">Email đã được xác thực</h1>
          <p className="text-[13px] text-muted-foreground">Tài khoản của bạn đã sẵn sàng sử dụng.</p>
        </>
      )}
      {status === 'error' && (
        <>
          <XCircle className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="text-lg font-semibold">Không thể xác thực</h1>
          <p className="text-[13px] text-muted-foreground">
            {message} Đăng nhập và bấm &ldquo;Gửi lại email&rdquo; để nhận liên kết mới.
          </p>
        </>
      )}
      {status !== 'loading' && (
        <Link
          href="/"
          className="inline-block rounded-full bg-primary px-6 py-2 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Vào PU Connector
        </Link>
      )}
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-8 px-4">
      <PuLogo markClassName="h-9 w-9" />
      <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin text-primary" />}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  )
}
