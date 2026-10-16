'use client'

import React, { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { LandingView } from '@/components/auth/landing-view'
import { useAppStore } from '@/store'
import { useSession } from '@/hooks/use-session'

interface AuthGuardProps {
  children: React.ReactNode
  // Hiện trong lúc kiểm tra phiên (vd. khung app dạng skeleton)
  fallback?: React.ReactNode
}

// Chỉ yêu cầu đã đăng nhập. Tại `/` nếu chưa đăng nhập sẽ hiện LandingView ngay tại chỗ
export function AuthGuard({ children, fallback = null }: AuthGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user: sessionUser, isLoading } = useSession()
  const storeUser = useAppStore((state) => state.user)
  const user = storeUser ?? sessionUser
  const isLoadingAuth = isLoading && !user

  useEffect(() => {
    if (!isLoading && !sessionUser && !storeUser && pathname !== '/') {
      router.replace('/')
    }
  }, [isLoading, sessionUser, storeUser, pathname, router])

  if (isLoadingAuth) return <>{fallback}</>

  if (!user) {
    return pathname === '/' ? <LandingView /> : null
  }

  return <>{children}</>
}
