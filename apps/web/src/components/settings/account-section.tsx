'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { BadgeCheck, ChevronRight, Loader2, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store'
import { useLogout } from '@/hooks/use-logout'
import { useWriteSessionUser } from '@/hooks/use-settings'
import { apiClient } from '@/lib/api-client'
import { SettingRow, SettingsGroup } from './settings-ui'

// Tài khoản: Tích Xanh, thông tin đăng nhập, mật khẩu, đăng xuất
export function AccountSection() {
  const user = useAppStore((s) => s.user)
  const writeUser = useWriteSessionUser()
  const { logout, isLoggingOut } = useLogout()
  const [isVerifying, setIsVerifying] = useState(false)

  if (!user) return null

  // Kiểm tra email trường ⇒ cấp Tích Xanh
  const verify = async () => {
    setIsVerifying(true)
    try {
      const res = await apiClient<{ data: { isVerified: boolean; message: string } }>('/users/verify-university', {
        method: 'POST'
      })
      if (res.data?.isVerified) {
        writeUser((u) => ({ ...u, isVerified: true }))
        toast.success(res.data.message || 'Tài khoản đã được cấp Tích Xanh chính quy!')
      } else {
        toast.info(res.data?.message || 'Email chưa đáp ứng điều kiện nhận Tích Xanh')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Không thể xác thực lúc này')
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <>
      {/* Xác thực sinh viên Phenikaa */}
      <div className="px-4 pt-2 pb-1 sm:px-5">
        <div
          className={
            user.isVerified
              ? 'flex items-start gap-3 rounded-xl bg-blue-500/[0.06] p-3.5'
              : 'flex items-start gap-3 rounded-xl bg-muted/50 p-3.5'
          }
        >
          <BadgeCheck
            className={user.isVerified ? 'mt-0.5 h-5 w-5 shrink-0 text-blue-500' : 'mt-0.5 h-5 w-5 shrink-0 text-muted-foreground'}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold">
              {user.isVerified ? 'Đã xác thực sinh viên Phenikaa' : 'Xác thực sinh viên Phenikaa'}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {user.isVerified ? (
                'Hồ sơ của bạn hiển thị Tích Xanh sinh viên chính thức.'
              ) : (
                <>
                  Tài khoản dùng email <span className="font-mono text-[11px] text-primary">@phenikaa-uni.edu.vn</span> sẽ
                  nhận Tích Xanh chính thức.
                </>
              )}
            </p>
          </div>
          {!user.isVerified && (
            <Button size="sm" onClick={verify} disabled={isVerifying} className="h-8 shrink-0 rounded-full px-3.5 text-xs">
              {isVerifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Kiểm tra'}
            </Button>
          )}
        </div>
      </div>

      <SettingsGroup label="Thông tin đăng nhập">
        <SettingRow label="Email" description={user.email} />
        <SettingRow label="Tên người dùng" description={`@${user.username}`} />
        {user.studentId && <SettingRow label="Mã sinh viên" description={user.studentId} />}
      </SettingsGroup>

      <SettingsGroup label="Bảo mật & hồ sơ">
        <LinkRow href="/forgot-password" label="Đổi mật khẩu" description="Nhận liên kết đặt lại mật khẩu qua email" />
        <LinkRow href={`/${user.username}?edit=1`} label="Chỉnh sửa hồ sơ" description="Ảnh, tiểu sử, khoa, lớp, kỹ năng" />
      </SettingsGroup>

      <div className="px-4 pt-1 pb-4 sm:px-5">
        <Button
          variant="ghost"
          onClick={logout}
          disabled={isLoggingOut}
          className="h-9 w-full justify-start gap-2 rounded-xl px-3 text-[13px] font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          {isLoggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
        </Button>
      </div>
    </>
  )
}

function LinkRow({ href, label, description }: { href: string; label: string; description: string }) {
  return (
    <Link href={href} className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/40">
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}
