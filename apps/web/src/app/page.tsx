'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store'
import { apiClient } from '@/lib/api-client'
import { AuthDialog } from '@/components/auth/auth-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Loader2, Phone, Mail, QrCode, ArrowRight, Sparkles } from 'lucide-react'
import type { UserProfile } from '@pu/schemas'

export default function LandingPage() {
  const router = useRouter()
  const user = useAppStore((state) => state.user)
  const setUser = useAppStore((state) => state.setUser)
  const setAuth = useAppStore((state) => state.setAuth)
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [emailOrUsername, setEmailOrUsername] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  // Auto redirect to /home if session already exists
  useEffect(() => {
    async function checkExistingSession() {
      try {
        const res = await apiClient<{ success: boolean; data: UserProfile }>('/auth/me')
        if (res && res.data) {
          setUser(res.data)
          router.replace('/home')
          return
        }
      } catch {
        setUser(null)
      } finally {
        setIsCheckingAuth(false)
      }
    }

    if (user) {
      router.replace('/home')
    } else {
      checkExistingSession()
    }
  }, [user, setUser, router])

  const handleQuickLogin = async (identifier: string) => {
    setIsLoggingIn(true)
    try {
      const res = await apiClient<{ success: boolean; data: UserProfile }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          emailOrUsername: identifier,
          password: 'password123'
        })
      })

      if (res.data) {
        setAuth(res.data)
        toast.success(`Chào mừng ${res.data.displayName} đã đăng nhập!`)
        router.replace('/home')
      }
    } catch (err: any) {
      toast.error(err.message || 'Đăng nhập thất bại')
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleContinueWithInput = (e: React.FormEvent) => {
    e.preventDefault()
    if (!emailOrUsername.trim()) {
      setIsAuthOpen(true)
      return
    }
    handleQuickLogin(emailOrUsername.trim())
  }

  if (isCheckingAuth || user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-black text-xl shadow-lg animate-pulse">
            PU
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <AuthDialog open={isAuthOpen} onOpenChange={setIsAuthOpen} />

      {/* Main Landing Hero (X-style 2 Columns) */}
      <main className="flex-1 flex flex-col-reverse lg:flex-row items-center justify-center max-w-7xl mx-auto w-full px-6 py-12 lg:py-0 gap-12 lg:gap-16">
        
        {/* Left Column: Headline & Action Buttons */}
        <div className="flex-1 flex flex-col justify-center max-w-lg w-full">
          {/* Small Top PU Icon */}
          <div className="mb-6 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-base shadow-sm">
              PU
            </div>
            <span className="font-extrabold text-sm tracking-tight text-foreground">
              PU Connector
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] mb-6 text-foreground">
            Đang diễn ra ngay bây giờ.
          </h1>

          <p className="text-xl sm:text-2xl font-bold tracking-tight mb-8 text-foreground">
            Tham gia mạng xã hội học thuật Phenikaa ngay hôm nay.
          </p>

          <div className="flex flex-col gap-3.5 max-w-xs w-full">
            {/* Primary Action Button */}
            <Button
              onClick={() => setIsAuthOpen(true)}
              className="w-full rounded-full h-10 font-bold text-xs gap-2 bg-foreground text-background hover:bg-foreground/90 transition-all shadow-sm"
            >
              <Mail className="h-4 w-4" />
              <span>Tiếp tục với Email sinh viên</span>
            </Button>

            {/* Google OAuth Option */}
            <Button
              variant="outline"
              onClick={() => toast.info('Tính năng đăng nhập Google SSO đang trong lộ trình phát triển.')}
              className="w-full rounded-full h-10 font-semibold text-xs gap-2.5 border-input bg-background hover:bg-muted text-foreground transition-all"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Tiếp tục với Google</span>
            </Button>

            {/* Microsoft Phenikaa Option */}
            <Button
              variant="outline"
              onClick={() => toast.info('Tính năng Microsoft 365 Phenikaa SSO đang được kết nối.')}
              className="w-full rounded-full h-10 font-semibold text-xs gap-2.5 border-input bg-background hover:bg-muted text-foreground transition-all"
            >
              <svg className="h-4 w-4" viewBox="0 0 23 23">
                <path fill="#f35325" d="M1 1h10v10H1z" />
                <path fill="#81bc06" d="M12 1h10v10H12z" />
                <path fill="#05a6f0" d="M1 12h10v10H1z" />
                <path fill="#ffba08" d="M12 12h10v10H12z" />
              </svg>
              <span>Tiếp tục với Phenikaa 365</span>
            </Button>

            {/* Divider */}
            <div className="flex items-center my-1">
              <div className="flex-1 border-t border-border" />
              <span className="px-3 text-xs text-muted-foreground font-medium">hoặc</span>
              <div className="flex-1 border-t border-border" />
            </div>

            {/* Quick Email or Username Input */}
            <form onSubmit={handleContinueWithInput} className="space-y-2">
              <Input
                type="text"
                placeholder="Email hoặc Tên đăng nhập"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                className="h-10 rounded-lg text-xs bg-background border-input text-foreground"
              />
              <Button
                type="submit"
                disabled={isLoggingIn}
                className="w-full rounded-full h-10 font-bold text-xs bg-muted text-foreground hover:bg-muted/80 transition-all border border-border"
              >
                {isLoggingIn ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span>Tiếp tục</span>
                )}
              </Button>
            </form>

            {/* Quick Test Accounts (Seeded Data) */}
            <div className="mt-3 p-3 rounded-xl bg-muted/40 border border-border text-[11px] space-y-1.5">
              <div className="flex items-center gap-1 text-xs font-bold text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                <span>Đăng nhập nhanh (Tài khoản mẫu seed):</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  onClick={() => handleQuickLogin('nguyenvanan')}
                  disabled={isLoggingIn}
                  className="px-2 py-1 rounded bg-background border border-border hover:border-primary text-foreground font-mono text-[10px] transition-colors cursor-pointer"
                >
                  nguyenvanan (K16 FIT)
                </button>
                <button
                  onClick={() => handleQuickLogin('tranminhduc')}
                  disabled={isLoggingIn}
                  className="px-2 py-1 rounded bg-background border border-border hover:border-primary text-foreground font-mono text-[10px] transition-colors cursor-pointer"
                >
                  tranminhduc (K16 FIT)
                </button>
                <button
                  onClick={() => handleQuickLogin('gv_nguyenvanha')}
                  disabled={isLoggingIn}
                  className="px-2 py-1 rounded bg-background border border-border hover:border-primary text-foreground font-mono text-[10px] transition-colors cursor-pointer"
                >
                  gv_nguyenvanha (Giảng viên)
                </button>
              </div>
            </div>

            {/* Terms Footnote */}
            <p className="text-[10px] text-muted-foreground leading-relaxed mt-2">
              Bằng việc tiếp tục, bạn đồng ý với{' '}
              <a href="#" className="underline hover:text-foreground">Điều khoản dịch vụ</a>,{' '}
              <a href="#" className="underline hover:text-foreground">Chính sách bảo mật</a> và{' '}
              <a href="#" className="underline hover:text-foreground">Quy định cộng đồng Phenikaa</a>.
            </p>
          </div>
        </div>

        {/* Right Column: Giant Iconic Stylized Logo (X Style) */}
        <div className="flex-1 flex items-center justify-center relative w-full max-w-lg lg:max-w-none">
          <div className="relative flex items-center justify-center w-64 h-64 sm:w-80 sm:h-80 lg:w-[450px] lg:h-[450px]">
            {/* Background Radial Glow */}
            <div className="absolute inset-0 bg-primary/10 rounded-full blur-3xl -z-10" />

            {/* Giant PU Geometric Logo */}
            <svg
              viewBox="0 0 200 200"
              className="w-full h-full text-foreground drop-shadow-2xl transition-transform hover:scale-105 duration-500"
              fill="currentColor"
            >
              {/* Outer Shape */}
              <rect x="25" y="25" width="150" height="150" rx="36" fill="currentColor" fillOpacity="0.04" stroke="currentColor" strokeWidth="10" />
              {/* Stylized P */}
              <path
                d="M 58 60 L 96 60 C 114 60 126 70 126 86 C 126 102 114 112 96 112 L 80 112 L 80 140 L 58 140 Z M 80 78 L 80 94 L 94 94 C 102 94 106 90 106 86 C 106 82 102 78 94 78 Z"
                fill="currentColor"
              />
              {/* Stylized U Connector Element */}
              <path
                d="M 124 104 L 144 104 L 144 126 C 144 136 136 144 126 144 L 110 144 C 100 144 92 136 92 126 L 92 120 L 112 120 L 112 126 C 112 128 114 130 118 130 L 122 130 C 124 130 126 128 126 126 Z"
                fill="currentColor"
                className="text-primary"
              />
            </svg>
          </div>

          {/* Floating Mobile QR Card (Bottom Right just like X) */}
          <div className="hidden xl:flex absolute -bottom-6 right-0 items-center gap-3 p-3.5 rounded-2xl bg-card/95 border border-border shadow-xl backdrop-blur-md">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted border border-border p-1">
              <QrCode className="h-10 w-10 text-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-foreground">Quét để tải App</span>
              <span className="text-[10px] text-muted-foreground">PU Connector Mobile (Expo)</span>
              <span className="text-[10px] font-mono text-primary font-semibold mt-0.5">iOS & Android</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer (Standard X Style) */}
      <footer className="w-full border-t border-border/40 py-4 px-6 text-center text-[11px] text-muted-foreground">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <a href="#" className="hover:underline">Giới thiệu</a>
          <a href="#" className="hover:underline">Tải ứng dụng</a>
          <a href="#" className="hover:underline">PU AI Assistant</a>
          <a href="#" className="hover:underline">Trợ giúp & Hỗ trợ</a>
          <a href="#" className="hover:underline">Điều khoản dịch vụ</a>
          <a href="#" className="hover:underline">Chính sách bảo mật</a>
          <a href="#" className="hover:underline">Quy chế học vụ</a>
          <a href="#" className="hover:underline">Cơ hội việc làm</a>
          <a href="#" className="hover:underline">Dành cho Nhà phát triển</a>
          <a href="#" className="hover:underline">Khả năng tiếp cận</a>
          <span>© 2026 Phenikaa University. All rights reserved.</span>
        </div>
      </footer>
    </div>
  )
}
