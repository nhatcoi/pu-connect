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
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { ShieldCheck, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface PrivacySettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialSettings?: {
    showEmail?: boolean
    showStudentId?: boolean
    showClass?: boolean
    isPrivateProfile?: boolean
  }
  isVerified?: boolean
  email?: string
  onSuccess: () => void
}

export function PrivacySettingsDialog({
  open,
  onOpenChange,
  initialSettings,
  isVerified = false,
  email = '',
  onSuccess
}: PrivacySettingsDialogProps) {
  const [showEmail, setShowEmail] = useState(initialSettings?.showEmail ?? false)
  const [showStudentId, setShowStudentId] = useState(initialSettings?.showStudentId ?? true)
  const [showClass, setShowClass] = useState(initialSettings?.showClass ?? true)
  const [isPrivateProfile, setIsPrivateProfile] = useState(initialSettings?.isPrivateProfile ?? false)
  const [isSaving, setIsSaving] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifiedState, setVerifiedState] = useState(isVerified)

  const handleSavePrivacy = async () => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/users/privacy', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          showEmail,
          showStudentId,
          showClass,
          isPrivateProfile
        })
      })

      if (!res.ok) {
        throw new Error('Không thể lưu cài đặt quyền riêng tư')
      }

      toast.success('Đã lưu quyền riêng tư')
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu cài đặt')
    } finally {
      setIsSaving(false)
    }
  }

  const handleVerifyUniversity = async () => {
    setIsVerifying(true)
    try {
      const res = await fetch('/api/users/verify-university', {
        method: 'POST'
      })
      const data = await res.json()
      if (data.isVerified) {
        setVerifiedState(true)
        toast.success(data.message || 'Tài khoản của bạn đã được cấp Tích Xanh chính quy!')
        onSuccess()
      } else {
        toast.info(data.message || 'Email chưa đáp ứng điều kiện nhận Tích Xanh')
      }
    } catch (err: any) {
      toast.error(err.message || 'Không thể xác thực lúc này')
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Cài đặt quyền riêng tư & Xác thực
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* University Verification Section */}
          <div className="p-3.5 rounded-xl border border-border/80 bg-muted/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className={`h-4 w-4 ${verifiedState ? 'text-blue-500 fill-blue-500/20' : 'text-muted-foreground'}`} />
                Xác thực sinh viên Phenikaa
              </span>
              {verifiedState ? (
                <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[11px] font-medium py-0.5">
                  Đã xác thực
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[11px] text-muted-foreground">
                  Chưa kích hoạt
                </Badge>
              )}
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Tài khoản sử dụng email chính quy <code className="text-primary font-mono text-[11px]">@phenikaa-uni.edu.vn</code> sẽ nhận huy hiệu Tích Xanh sinh viên chính thức.
            </p>

            {!verifiedState && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleVerifyUniversity}
                disabled={isVerifying}
                className="w-full text-xs h-8 font-medium"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Đang kiểm tra email trường...
                  </>
                ) : (
                  'Kiểm tra & Cấp Tích Xanh chính quy'
                )}
              </Button>
            )}
          </div>

          {/* Privacy Toggles */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Hiển thị thông tin hồ sơ
            </h4>

            {/* Email Toggle */}
            <div className="flex items-center justify-between space-x-2">
              <label htmlFor="showEmail" className="text-xs font-medium cursor-pointer flex flex-col gap-0.5">
                <span>Hiển thị Email công khai</span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  Cho phép mọi người xem địa chỉ email trên hồ sơ
                </span>
              </label>
              <Switch
                id="showEmail"
                checked={showEmail}
                onCheckedChange={setShowEmail}
              />
            </div>

            {/* Student ID Toggle */}
            <div className="flex items-center justify-between space-x-2">
              <label htmlFor="showStudentId" className="text-xs font-medium cursor-pointer flex flex-col gap-0.5">
                <span>Hiển thị Mã sinh viên (MSSV)</span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  Giúp bạn bè và giảng viên dễ dàng nhận diện
                </span>
              </label>
              <Switch
                id="showStudentId"
                checked={showStudentId}
                onCheckedChange={setShowStudentId}
              />
            </div>

            {/* Class Name Toggle */}
            <div className="flex items-center justify-between space-x-2">
              <label htmlFor="showClass" className="text-xs font-medium cursor-pointer flex flex-col gap-0.5">
                <span>Hiển thị Lớp sinh hoạt</span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  Hiển thị tên lớp sinh hoạt chính quy (VD: K16-CNTT1)
                </span>
              </label>
              <Switch
                id="showClass"
                checked={showClass}
                onCheckedChange={setShowClass}
              />
            </div>

            {/* Private Profile Toggle */}
            <div className="flex items-center justify-between space-x-2 pt-1 border-t border-border/60">
              <label htmlFor="isPrivateProfile" className="text-xs font-medium cursor-pointer flex flex-col gap-0.5">
                <span>Hồ sơ riêng tư</span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  Chỉ sinh viên đang theo dõi mới có thể xem các bài viết của bạn
                </span>
              </label>
              <Switch
                id="isPrivateProfile"
                checked={isPrivateProfile}
                onCheckedChange={setIsPrivateProfile}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Đóng
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSavePrivacy}
            disabled={isSaving}
            className="min-w-[90px]"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Đang lưu...
              </>
            ) : (
              'Lưu cài đặt'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
