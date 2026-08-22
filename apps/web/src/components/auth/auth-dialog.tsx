'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useAppStore } from '@/store'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import { LogIn, UserPlus, Loader2, Sparkles } from 'lucide-react'
import type { UserProfile } from '@pu/schemas'

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const setAuth = useAppStore((state) => state.setAuth)
  const [tab, setTab] = useState<'login' | 'register'>('login')

  // Login form state
  const [emailOrUsername, setEmailOrUsername] = useState('22010001@phenikaa-uni.edu.vn')
  const [password, setPassword] = useState('password123')

  // Register form state
  const [regEmail, setRegEmail] = useState('')
  const [regUsername, setRegUsername] = useState('')
  const [regDisplayName, setRegDisplayName] = useState('')
  const [regStudentId, setRegStudentId] = useState('')
  const [regFaculty, setRegFaculty] = useState('FIT')
  const [regPassword, setRegPassword] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!emailOrUsername.trim() || !password.trim()) {
      toast.error('Vui lòng nhập đầy đủ thông tin')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await apiClient<{ success: boolean; data: UserProfile }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          emailOrUsername: emailOrUsername.trim(),
          password: password.trim()
        })
      })

      if (res.data) {
        setAuth(res.data)
        toast.success(`Chào mừng ${res.data.displayName} quay trở lại!`)
        onOpenChange(false)
      }
    } catch (err: any) {
      toast.error(err.message || 'Đăng nhập thất bại')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!regEmail.trim() || !regUsername.trim() || !regDisplayName.trim() || !regPassword.trim()) {
      toast.error('Vui lòng điền đầy đủ các trường bắt buộc')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await apiClient<{ success: boolean; data: UserProfile }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: regEmail.trim(),
          username: regUsername.trim(),
          displayName: regDisplayName.trim(),
          studentId: regStudentId.trim() || undefined,
          faculty: regFaculty,
          password: regPassword.trim()
        })
      })

      if (res.data) {
        setAuth(res.data)
        toast.success('Đăng ký tài khoản Phenikaa thành công!')
        onOpenChange(false)
      }
    } catch (err: any) {
      toast.error(err.message || 'Đăng ký thất bại')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader className="text-center sm:text-center pb-2">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-lg mb-2">
            PU
          </div>
          <DialogTitle className="text-lg font-bold text-foreground">
            Cổng Đăng Nhập Sinh Viên Phenikaa
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Đăng nhập để chia sẻ tài liệu, đặt câu hỏi và tham gia nhóm đồ án.
          </p>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="login" className="gap-1.5 text-xs">
              <LogIn className="h-3.5 w-3.5" />
              <span>Đăng nhập</span>
            </TabsTrigger>
            <TabsTrigger value="register" className="gap-1.5 text-xs">
              <UserPlus className="h-3.5 w-3.5" />
              <span>Đăng ký mới</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1 text-foreground">Email hoặc Tên đăng nhập</label>
                <Input
                  type="text"
                  placeholder="22010001@phenikaa-uni.edu.vn"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  className="bg-background text-foreground"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1 text-foreground">Mật khẩu</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-background text-foreground"
                />
              </div>

              <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground border border-border">
                <span className="font-semibold text-foreground">Tài khoản seed mẫu:</span>
                <p className="mt-0.5 font-mono">nguyenvanan (Pass: password123)</p>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 gap-1.5 bg-primary text-primary-foreground"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                <span>Đăng nhập Session</span>
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1 text-foreground">Họ và tên</label>
                <Input
                  placeholder="Nguyễn Văn A"
                  value={regDisplayName}
                  onChange={(e) => setRegDisplayName(e.target.value)}
                  className="bg-background text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1 text-foreground">Mã sinh viên</label>
                  <Input
                    placeholder="23010199"
                    value={regStudentId}
                    onChange={(e) => setRegStudentId(e.target.value)}
                    className="bg-background text-foreground"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1 text-foreground">Khoa / Viện</label>
                  <select
                    value={regFaculty}
                    onChange={(e) => setRegFaculty(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground outline-none"
                  >
                    <option value="FIT">CNTT (FIT)</option>
                    <option value="FCS">Khoa học Máy tính (FCS)</option>
                    <option value="FEE">Điện - Điện tử (FEE)</option>
                    <option value="FAE">Kỹ thuật Ô tô (FAE)</option>
                    <option value="FBA">Kinh tế & QTKD (FBA)</option>
                    <option value="FEL">Ngôn ngữ Anh (FEL)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1 text-foreground">Email Phenikaa</label>
                <Input
                  type="email"
                  placeholder="23010199@phenikaa-uni.edu.vn"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="bg-background text-foreground"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1 text-foreground">Tên đăng nhập (Username)</label>
                <Input
                  placeholder="nguyenvana"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  className="bg-background text-foreground"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1 text-foreground">Mật khẩu</label>
                <Input
                  type="password"
                  placeholder="Tối thiểu 6 ký tự..."
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="bg-background text-foreground"
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 gap-1.5 bg-primary text-primary-foreground"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                <span>Đăng ký & Đăng nhập</span>
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
