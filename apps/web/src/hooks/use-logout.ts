'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

export function useLogout() {
  const router = useRouter()
  const logoutStore = useAppStore((state) => state.logout)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true)
    try {
      // 1. Gửi request hủy session lên server
      await apiClient('/auth/logout', { method: 'POST' })
    } catch {
      // Bỏ qua lỗi mạng nếu server không phản hồi, vẫn tiếp tục xóa state client
    } finally {
      // 2. Xóa state đăng nhập trong Zustand store
      logoutStore()

      // 3. Xóa các cache/session storage nếu có
      try {
        if (typeof window !== 'undefined') {
          sessionStorage.clear()
        }
      } catch {
        // ignore
      }

      // 4. Hiển thị thông báo toast chuẩn UX
      toast.success('Đã đăng xuất phiên làm việc an toàn')

      // 5. Chuyển hướng sạch về trang chủ (landing page /)
      if (typeof window !== 'undefined') {
        window.location.href = '/'
      } else {
        router.replace('/')
      }
      setIsLoggingOut(false)
    }
  }, [logoutStore, router])

  return {
    logout: handleLogout,
    isLoggingOut
  }
}
