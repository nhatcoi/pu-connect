'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store'
import { useSession } from '@/hooks/use-session'
import { Loader2 } from 'lucide-react'

interface AuthGuardProps {
  children: React.ReactNode
}

// Chỉ yêu cầu đã đăng nhập. Phiên lấy từ cache ['me'] ⇒ chuyển trang không gọi lại /auth/me
export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()
  const { user: sessionUser, isLoading } = useSession()
  const storeUser = useAppStore((state) => state.user)
  const user = storeUser ?? sessionUser
  const isLoadingAuth = isLoading && !user

  useEffect(() => {
    if (!isLoading && !sessionUser && !storeUser) router.replace('/')
  }, [isLoading, sessionUser, storeUser, router])

  if (isLoadingAuth && !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-black text-xl shadow-lg animate-pulse">
            PU
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Đang xác thực phiên làm việc...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <>{children}</>
}
