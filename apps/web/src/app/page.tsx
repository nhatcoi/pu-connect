'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store'
import { useSession } from '@/hooks/use-session'
import { AuthForm } from '@/components/auth/auth-form'
import { PuLogo, PuMark } from '@/components/brand/pu-logo'
import { HeroNetwork } from '@/components/brand/hero-network'
import Link from 'next/link'
import { FEATURES } from '@/lib/features'
import { LEGAL_LINKS } from '@/lib/legal'
import { QrCode } from 'lucide-react'

export default function LandingPage() {
  const router = useRouter()
  const user = useAppStore((state) => state.user)
  const { isLoading: isCheckingAuth } = useSession()

  // Đã có phiên ⇒ vào thẳng /home
  useEffect(() => {
    if (user) router.replace('/home')
  }, [user, router])

  if (isCheckingAuth || user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <PuMark className="h-14 w-14 animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* Main Landing Hero (X-style 2 Columns) */}
      <main className="flex-1 flex flex-col-reverse lg:flex-row items-center justify-center max-w-7xl mx-auto w-full px-6 py-12 lg:py-0 gap-12 lg:gap-16">
        
        {/* Left Column: Headline & Action Buttons */}
        <div className="flex-1 flex flex-col justify-center max-w-lg w-full">
          {/* Small Top PU Icon */}
          <PuLogo className="mb-6" markClassName="h-10 w-10" showTagline />

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] mb-10 text-foreground">
            Mạng xã hội <span className="text-primary">học thuật</span> cộng đồng
            <span className="text-brand-orange">.</span>
          </h1>

          <div className="max-w-xs w-full">
            <AuthForm />

            <p className="text-[11px] text-muted-foreground leading-relaxed mt-5">
              Bằng việc tiếp tục, bạn đồng ý với{' '}
              <Link href="/terms" className="text-primary hover:underline">Điều khoản dịch vụ</Link> và{' '}
              <Link href="/privacy-policy" className="text-primary hover:underline">Chính sách bảo mật</Link> của PU Connector.
            </p>
          </div>
        </div>

        {/* Right Column: Animated network vector (Hiệu ứng mạng lưới kết nối) */}
        <div className="flex-1 flex items-center justify-center relative w-full max-w-lg lg:max-w-none">
          <HeroNetwork />

          {/* Thẻ QR tải app (ẩn tới khi phát hành mobile) */}
          {FEATURES.mobileAppPromo && (
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
          )}
        </div>
      </main>

      {/* Footer (Standard X Style) */}
      <footer className="w-full py-4 px-6 text-center text-[11px] text-muted-foreground">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:underline">
              {l.label}
            </Link>
          ))}
          <span>© 2026 Phenikaa University. All rights reserved.</span>
        </div>
      </footer>
    </div>
  )
}
