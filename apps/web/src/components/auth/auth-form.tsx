'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { Eye, EyeOff, Loader2, Pencil } from 'lucide-react'
import { LoginSchema, RegisterSchema } from '@pu/schemas'
import type { UserProfile } from '@pu/schemas'
import { toast } from 'sonner'
import { Button } from '@/components/animate-ui/primitives/buttons/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/store'
import { apiClient } from '@/lib/api-client'
import { cn } from '@/lib/utils'

// Luồng: nhập email → kiểm tra → hiện mật khẩu (đăng nhập) hoặc họ tên + mật khẩu (đăng ký)
type Step = 'email' | 'login' | 'register' | 'google-only'
type FieldErrors = Partial<Record<'displayName' | 'email' | 'emailOrUsername' | 'password', string>>

interface AuthFormProps {
  onSuccess?: () => void
}

const GOOGLE_ERRORS: Record<string, string> = {
  google: 'Đăng nhập Google không thành công. Vui lòng thử lại.',
  google_unavailable: 'Đăng nhập Google hiện chưa khả dụng.',
  suspended: 'Tài khoản của bạn đã bị khóa. Liên hệ quản trị viên nếu đây là nhầm lẫn.'
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  )
}

function Field({
  id,
  label,
  error,
  children
}: {
  id: string
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-foreground">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

// Chiều cao tự động + mờ dần khi hiện/ẩn khối trường nhập
function Reveal({ children, show }: { children: React.ReactNode; show: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 38 }}
          className="overflow-hidden"
        >
          <div className="space-y-3.5 pt-0.5">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Form đăng nhập / đăng ký: Google + email trước, rồi mật khẩu
export function AuthForm({ onSuccess }: AuthFormProps) {
  const router = useRouter()
  const setAuth = useAppStore((state) => state.setAuth)

  const [step, setStep] = useState<Step>('email')
  const [googleEnabled, setGoogleEnabled] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [isBusy, setIsBusy] = useState(false)
  const passwordRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  // Bật nút Google khi backend đã cấu hình
  useEffect(() => {
    apiClient<{ success: boolean; data: { google: boolean } }>('/auth/providers')
      .then((res) => setGoogleEnabled(!!res.data?.google))
      .catch(() => setGoogleEnabled(false))
  }, [])

  // Thông báo lỗi khi Google redirect về /?auth_error=...
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('auth_error')
    if (code && GOOGLE_ERRORS[code]) {
      toast.error(GOOGLE_ERRORS[code])
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  // Đưa con trỏ vào ô tiếp theo sau khi khối mới hiện ra
  useEffect(() => {
    if (step === 'login') passwordRef.current?.focus()
    if (step === 'register') nameRef.current?.focus()
  }, [step])

  const resetToEmail = () => {
    setStep('email')
    setErrors({})
    setPassword('')
    setDisplayName('')
    setShowPassword(false)
  }

  // Bước 1: kiểm tra email / username
  const handleContinue = async () => {
    const value = email.trim()
    if (!value) {
      setErrors({ email: 'Vui lòng nhập email hoặc tên đăng nhập' })
      return
    }
    // Không có "@": coi như tên đăng nhập → đăng nhập luôn
    if (!value.includes('@')) {
      setErrors({})
      setStep('login')
      return
    }
    if (!RegisterSchema.shape.email.safeParse(value).success) {
      setErrors({ email: 'Email không hợp lệ' })
      return
    }

    setErrors({})
    setIsBusy(true)
    try {
      const res = await apiClient<{ success: boolean; data: { exists: boolean; hasPassword: boolean } }>(
        '/auth/check-email',
        { method: 'POST', body: JSON.stringify({ email: value }) }
      )
      if (!res.data.exists) setStep('register')
      else setStep(res.data.hasPassword ? 'login' : 'google-only')
    } catch (err: any) {
      setErrors({ email: err.message || 'Không thể kiểm tra email, vui lòng thử lại' })
    } finally {
      setIsBusy(false)
    }
  }

  // Bước 2: đăng nhập hoặc tạo tài khoản
  const handleSubmit = async () => {
    const isRegister = step === 'register'
    const parsed = isRegister
      ? RegisterSchema.safeParse({ displayName, email, password })
      : LoginSchema.safeParse({ emailOrUsername: email, password })

    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors
        if (!next[key]) next[key] = issue.message
      }
      setErrors(next)
      return
    }

    setErrors({})
    setIsBusy(true)
    try {
      const res = await apiClient<{ success: boolean; data: UserProfile }>(
        isRegister ? '/auth/register' : '/auth/login',
        { method: 'POST', body: JSON.stringify(parsed.data) }
      )
      if (res.data) {
        setAuth(res.data)
        toast.success(
          isRegister
            ? 'Tạo tài khoản thành công! Hãy kiểm tra email để xác thực tài khoản.'
            : `Chào mừng ${res.data.displayName} quay lại!`
        )
        onSuccess?.()
        router.replace('/home')
      }
    } catch (err: any) {
      setErrors({ password: err.message || 'Có lỗi xảy ra, vui lòng thử lại' })
    } finally {
      setIsBusy(false)
    }
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isBusy) return
    if (step === 'email') void handleContinue()
    else if (step === 'login' || step === 'register') void handleSubmit()
  }

  const inputClass = (hasError?: string) =>
    cn('h-10 rounded-lg text-[13px]', hasError && 'border-destructive focus-visible:ring-destructive')

  const emailLocked = step !== 'email'
  const emailError = errors.email || errors.emailOrUsername

  return (
    <div className="w-full space-y-4">
      {googleEnabled && (
        <>
          <Button
            asChild
            className="inline-flex items-center justify-center w-full rounded-full h-10 gap-2.5 border border-input bg-background text-[13px] font-semibold text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
          >
            {/* Điều hướng toàn trang sang Google (OAuth redirect qua API, không phải trang Next) */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/api/auth/google">
              <GoogleIcon />
              <span>Tiếp tục với Google</span>
            </a>
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            hoặc
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-3.5">
        <Field id="email" label="Email hoặc tên đăng nhập" error={emailError}>
          <div className="relative">
            <Input
              id="email"
              autoComplete="username"
              placeholder="ten@phenikaa-uni.edu.vn"
              value={email}
              readOnly={emailLocked}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!emailError}
              className={cn(inputClass(emailError), emailLocked && 'pr-10 bg-muted/40')}
            />
            {emailLocked && (
              <button
                type="button"
                onClick={resetToEmail}
                aria-label="Đổi email"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>
        </Field>

        {/* Email chưa có tài khoản → đăng ký */}
        <Reveal show={step === 'register'}>
          <p className="text-xs text-muted-foreground">Email này chưa có tài khoản. Tạo tài khoản mới:</p>
          <Field id="displayName" label="Họ và tên" error={errors.displayName}>
            <Input
              id="displayName"
              ref={nameRef}
              autoComplete="name"
              placeholder="Nguyễn Văn A"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              aria-invalid={!!errors.displayName}
              className={inputClass(errors.displayName)}
            />
          </Field>
        </Reveal>

        {/* Email đã đăng ký bằng Google, chưa có mật khẩu */}
        <Reveal show={step === 'google-only'}>
          <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            Email này đã đăng ký bằng Google. Hãy chọn <b className="text-foreground">Tiếp tục với Google</b> để đăng nhập.
          </p>
        </Reveal>

        {/* Mật khẩu: hiện sau khi đã biết email */}
        <Reveal show={step === 'login' || step === 'register'}>
          <Field id="password" label="Mật khẩu" error={errors.password}>
            <div className="relative">
              <Input
                id="password"
                ref={passwordRef}
                type={showPassword ? 'text' : 'password'}
                autoComplete={step === 'register' ? 'new-password' : 'current-password'}
                placeholder={step === 'register' ? 'Ít nhất 8 ký tự' : 'Nhập mật khẩu'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!errors.password}
                className={cn(inputClass(errors.password), 'pr-10')}
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
          </Field>
          {step === 'login' && (
            <div className="-mt-1 text-right">
              <Link
                href={`/forgot-password${email.includes('@') ? `?email=${encodeURIComponent(email.trim())}` : ''}`}
                className="text-xs font-medium text-primary hover:underline"
              >
                Quên mật khẩu?
              </Link>
            </div>
          )}
        </Reveal>

        {step !== 'google-only' && (
          <Button
            type="submit"
            disabled={isBusy}
            className="inline-flex items-center justify-center w-full rounded-full h-10 bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer"
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : step === 'register' ? (
              'Tạo tài khoản'
            ) : step === 'login' ? (
              'Đăng nhập'
            ) : (
              'Tiếp tục'
            )}
          </Button>
        )}
      </form>
    </div>
  )
}
