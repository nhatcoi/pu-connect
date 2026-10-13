'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store'
import { useSession } from '@/hooks/use-session'

interface AuthGuardProps {
  children: React.ReactNode
  // Hiện trong lúc kiểm tra phiên (vd. khung app dạng skeleton)
  fallback?: React.ReactNode
}

// Chỉ yêu cầu đã đăng nhập. Phiên lấy từ cache ['me'] ⇒ chuyển trang không gọi lại /auth/me
export function AuthGuard({ children, fallback = null }: AuthGuardProps) {
  const router = useRouter()
  const { user: sessionUser, isLoading } = useSession()
  const storeUser = useAppStore((state) => state.user)
  const user = storeUser ?? sessionUser
  const isLoadingAuth = isLoading && !user

  useEffect(() => {
    if (!isLoading && !sessionUser && !storeUser) router.replace('/')
  }, [isLoading, sessionUser, storeUser, router])

  if (isLoadingAuth) return <>{fallback}</>

  if (!user) {
    return null
  }

  return <>{children}</>
}
