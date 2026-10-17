import React, { useState } from 'react'
import { AlertCircle, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { adminApi, ROLE_SHORT, WEB_PORTAL_URL } from '@/lib/api'
import { Button, Field, Input } from '@/components/ui'

interface LoginScreenProps {
  forbiddenRole?: string | null
  onSuccess: () => void
  onLogout?: () => void
}

export function LoginScreen({ forbiddenRole, onSuccess, onLogout }: LoginScreenProps) {
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id.trim() || !password) return
    setLoading(true)
    setError(null)
    try {
      await adminApi.post('/auth/login', { emailOrUsername: id.trim(), password })
      toast.success('Đăng nhập thành công')
      onSuccess()
    } catch (err) {
      setError((err as Error).message || 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/brand/pu-mark.svg" alt="" className="mb-4 size-12" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">PU Connector Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">Đăng nhập để tiếp tục</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {forbiddenRole ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-amber-500/12 text-warning">
                <ShieldAlert className="size-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Không có quyền truy cập</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tài khoản <b className="text-foreground">{ROLE_SHORT[forbiddenRole] ?? forbiddenRole}</b> không dùng được trang quản trị.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {onLogout && (
                  <Button variant="primary" onClick={onLogout}>
                    Đổi tài khoản
                  </Button>
                )}
                <a href={WEB_PORTAL_URL} className="text-sm font-medium text-primary hover:underline">
                  Về PU Connector
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-2 text-sm text-danger">
                  <AlertCircle className="size-4 shrink-0" />
                  {error}
                </div>
              )}
              <Field label="Email hoặc username">
                <Input required autoFocus autoComplete="username" value={id} onChange={(e) => setId(e.target.value)} />
              </Field>
              <Field label="Mật khẩu">
                <Input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <Button type="submit" variant="primary" loading={loading} className="w-full">
                Đăng nhập
              </Button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">Dành cho Quản trị viên, Giảng viên và Trợ giảng</p>
      </div>
    </div>
  )
}
