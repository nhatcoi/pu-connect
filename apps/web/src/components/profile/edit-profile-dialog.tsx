'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { X, Camera, Image as ImageIcon, ChevronRight, Loader2, Check, RotateCcw, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AcademicUnitSelector } from './academic-unit-selector'
import { errorMessage } from '@/lib/api-client'

interface EditProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData: {
    displayName: string
    bio?: string | null
    school?: string | null
    faculty?: string | null
    major?: string | null
    academicYear?: string | null
    className?: string | null
    avatarUrl?: string | null
    bannerUrl?: string | null
    location?: string | null
    website?: string | null
    birthDate?: string | null
  }
  onSuccess: () => void
}

// Danh sách kiểu hoạt họa sinh viên (Dicebear)
const IMAGINE_STYLES = ['avataaars', 'bottts', 'adventurer', 'lorelei', 'micah']

// Các mẫu ảnh bìa học thuật & campus chọn nhanh
const BANNER_PRESETS = [
  {
    id: 'phenikaa-campus',
    name: 'Phenikaa Campus',
    url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&auto=format&fit=crop&q=80'
  },
  {
    id: 'library-academic',
    name: 'Thư viện học thuật',
    url: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=1200&auto=format&fit=crop&q=80'
  },
  {
    id: 'tech-cyber',
    name: 'Công nghệ & Lập trình',
    url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&auto=format&fit=crop&q=80'
  },
  {
    id: 'abstract-gradient',
    name: 'Gradient tối giản',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80'
  }
]

// Ngày sinh lưu YYYY-MM-DD ⇒ hiển thị dd/mm/yyyy
const formatBirthDate = (value: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value || 'Chưa cập nhật'
}

// Chi tiết lỗi tải ảnh (bỏ thông điệp chung chung "upload failed")
const uploadErrorDetail = (err: unknown) => {
  const msg = errorMessage(err, '')
  return msg && msg !== 'upload failed' ? `: ${msg}` : ''
}

export function EditProfileDialog({ open, onOpenChange, initialData, onSuccess }: EditProfileDialogProps) {
  // State form fields
  const [displayName, setDisplayName] = useState(initialData.displayName || '')
  const [bio, setBio] = useState(initialData.bio || '')
  const [school, setSchool] = useState(initialData.school || '')
  const [faculty, setFaculty] = useState(initialData.faculty || '')
  const [major, setMajor] = useState(initialData.major || '')
  const [academicYear, setAcademicYear] = useState(initialData.academicYear || '')
  const [className, setClassName] = useState(initialData.className || '')
  // Đơn vị chọn từ cây học thuật: undefined = không đổi, string = đơn vị mới, null = nhập tay / xóa
  const [unitId, setUnitId] = useState<string | null | undefined>(undefined)
  const [avatarUrl, setAvatarUrl] = useState(initialData.avatarUrl || '')
  const [bannerUrl, setBannerUrl] = useState(initialData.bannerUrl || '')
  const [location, setLocation] = useState(initialData.location || '')
  const [website, setWebsite] = useState(initialData.website || '')
  const [birthDate, setBirthDate] = useState(initialData.birthDate || '')

  // Trạng thái UI phụ trợ
  const [isEditingBirthDate, setIsEditingBirthDate] = useState(false)
  const [showBannerPresets, setShowBannerPresets] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isUploadingBanner, setIsUploadingBanner] = useState(false)

  // Ref input file
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  // Nạp dữ liệu 1 lần khi vừa mở (cha render lại không xóa nội dung đang sửa)
  // Snapshot on open only: parent re-renders must not reset in-progress edits
  const initialRef = useRef(initialData)
  initialRef.current = initialData
  useEffect(() => {
    if (open) {
      const initialData = initialRef.current
      setDisplayName(initialData.displayName || '')
      setBio(initialData.bio || '')
      setSchool(initialData.school || '')
      setFaculty(initialData.faculty || '')
      setMajor(initialData.major || '')
      setAcademicYear(initialData.academicYear || '')
      setClassName(initialData.className || '')
      setUnitId(undefined)
      setAvatarUrl(initialData.avatarUrl || '')
      setBannerUrl(initialData.bannerUrl || '')
      setLocation(initialData.location || '')
      setWebsite(initialData.website || '')
      setBirthDate(initialData.birthDate || '')
      setIsEditingBirthDate(false)
      setShowBannerPresets(false)
    }
  }, [open])

  // Tải lên Avatar cá nhân
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload/file?folder=avatars', {
        method: 'POST',
        body: formData
      })
      const data = await res.json().catch(() => null)
      const uploadedUrl = data?.data?.url || data?.data?.publicUrl
      if (!res.ok || !uploadedUrl) throw new Error(typeof data?.message === 'string' ? data.message : 'upload failed')
      setAvatarUrl(uploadedUrl)
    } catch (err) {
      // Không dùng blob: URL tạm (chỉ tồn tại trên máy này) ⇒ giữ ảnh cũ
      toast.error(`Không tải được ảnh đại diện lên${uploadErrorDetail(err)}`)
      e.target.value = ''
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  // Tải lên Ảnh bìa (Cover Banner)
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingBanner(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload/file?folder=banners', {
        method: 'POST',
        body: formData
      })
      const data = await res.json().catch(() => null)
      const uploadedUrl = data?.data?.url || data?.data?.publicUrl
      if (!res.ok || !uploadedUrl) throw new Error(typeof data?.message === 'string' ? data.message : 'upload failed')
      setBannerUrl(uploadedUrl)
    } catch (err) {
      // Không dùng blob: URL tạm (chỉ tồn tại trên máy này) ⇒ giữ ảnh cũ
      toast.error(`Không tải được ảnh bìa lên${uploadErrorDetail(err)}`)
      e.target.value = ''
    } finally {
      setIsUploadingBanner(false)
    }
  }

  // Xóa ảnh bìa (về ảnh bìa mặc định)
  const handleRemoveBanner = () => {
    setBannerUrl('')
    toast.info('Đã đặt lại ảnh bìa mặc định')
  }

  // Chọn ảnh bìa mẫu có sẵn
  const handleSelectPresetBanner = (presetUrl: string) => {
    setBannerUrl(presetUrl)
    setShowBannerPresets(false)
  }

  // Sinh avatar hoạt họa AI Imagine
  const handleGenerateImagineAvatar = () => {
    const style = IMAGINE_STYLES[Math.floor(Math.random() * IMAGINE_STYLES.length)]
    const seed = Math.random().toString(36).substring(2, 9)
    const newAvatar = `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`
    setAvatarUrl(newAvatar)
  }

  // Lưu hồ sơ cá nhân
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!displayName.trim()) {
      toast.error('Tên hiển thị không được để trống')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          displayName: displayName.trim(),
          bio: bio.trim() || null,
          school: school.trim() || null,
          faculty: faculty.trim() || null,
          major: major.trim() || null,
          academicYear: academicYear.trim() || null,
          className: className.trim() || null,
          ...(unitId !== undefined ? { unitId } : {}),
          avatarUrl: avatarUrl.trim() || null,
          bannerUrl: bannerUrl ? bannerUrl.trim() : null,
          location: location.trim() || null,
          website: website.trim() || null,
          birthDate: birthDate.trim() || null
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.message || 'Cập nhật thất bại')
      }

      toast.success('Đã cập nhật hồ sơ')
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(errorMessage(err, 'Có lỗi xảy ra khi lưu thông tin'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 max-w-[720px] sm:max-w-[720px] w-full max-h-[92vh] bg-card text-card-foreground border border-border rounded-2xl overflow-hidden flex flex-col shadow-2xl transition-colors duration-200"
      >
        {/* Hidden File Inputs */}
        <input type="file" ref={avatarInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" aria-hidden="true" />
        <input type="file" ref={bannerInputRef} onChange={handleBannerUpload} accept="image/*" className="hidden" aria-hidden="true" />

        {/* 1. Header Bar (Linh hoạt Theme: Light & Dark) */}
        <div className="sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-card/85 backdrop-blur-md border-b border-border shrink-0 transition-colors">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-9 w-9 rounded-full flex items-center justify-center text-foreground/80 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              aria-label="Đóng hộp thoại"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">Edit profile</h3>
          </div>

          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isSubmitting || isUploadingAvatar || isUploadingBanner}
            className="rounded-full bg-foreground text-background hover:bg-foreground/90 font-bold px-4 py-1.5 text-sm transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-1.5 shadow-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-background" />
                <span>Saving...</span>
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {/* 2. Cover Banner Header với Đầy Đủ Logic Ảnh Bìa */}
          <div className="relative h-32 sm:h-44 w-full bg-muted flex items-center justify-center overflow-hidden group/banner">
            {bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- xem trước ảnh vừa chọn (blob URL)
              <img src={bannerUrl} alt="Ảnh bìa hồ sơ" className="absolute inset-0 w-full h-full object-cover transition-transform duration-300" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-800 dark:from-blue-950 dark:via-indigo-950 dark:to-slate-950">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/25 transition-opacity" />

            {/* Các nút thao tác trên ảnh bìa */}
            <div className="relative z-10 flex items-center gap-2">
              {/* Nút đổi ảnh bìa qua tệp */}
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                disabled={isUploadingBanner}
                className="h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-xs transition-all cursor-pointer hover:scale-105 shadow-md border border-white/20"
                aria-label="Thay đổi ảnh bìa"
              >
                {isUploadingBanner ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Camera className="h-5 w-5" />}
              </button>

              {/* Nút chọn ảnh bìa mẫu */}
              <button
                type="button"
                onClick={() => setShowBannerPresets(!showBannerPresets)}
                className="h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-xs transition-all cursor-pointer hover:scale-105 shadow-md border border-white/20"
                aria-label="Chọn ảnh bìa mẫu"
              >
                <Palette className="h-4 w-4" />
              </button>

              {/* Nút xóa ảnh bìa nếu đang có ảnh tùy chỉnh */}
              {bannerUrl ? (
                <button
                  type="button"
                  onClick={handleRemoveBanner}
                  className="h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-xs transition-all cursor-pointer hover:scale-105 shadow-md border border-white/20"
                  aria-label="Xóa ảnh bìa tùy chỉnh"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {/* Panel chọn ảnh bìa mẫu có sẵn (Mở khi bấm Palette) */}
            {showBannerPresets && (
              <div className="absolute inset-x-3 bottom-3 z-20 p-2.5 bg-card/95 backdrop-blur-md rounded-xl border border-border shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-semibold text-foreground">Chọn ảnh bìa học thuật:</span>
                  <button
                    type="button"
                    onClick={() => setShowBannerPresets(false)}
                    className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {BANNER_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPresetBanner(preset.url)}
                      className="group/preset relative h-12 rounded-lg overflow-hidden border border-border/80 hover:border-primary transition-all cursor-pointer"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- xem trước ảnh vừa chọn (blob URL) */}
                      <img src={preset.url} alt={preset.name} className="w-full h-full object-cover group-hover/preset:scale-105 transition-transform" />
                      <span className="absolute inset-x-0 bottom-0 bg-black/60 text-[10px] text-white truncate px-1 py-0.5 text-center">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. Avatar & Thẻ "Edit your photo with Imagine" */}
          <div className="-mt-12 sm:-mt-14 px-4 flex items-center gap-3.5 relative z-10 mb-4">
            {/* Avatar Circle với Nút Camera Overlay */}
            <div className="relative group shrink-0">
              <Avatar className="h-22 w-22 sm:h-26 sm:w-26 rounded-full border-4 border-card bg-muted shadow-xl overflow-hidden ring-1 ring-border/80">
                <AvatarImage src={avatarUrl || ''} alt={displayName} className="object-cover" />
                <AvatarFallback className="bg-muted text-foreground font-bold text-xl sm:text-2xl">
                  {(displayName || 'PU').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute inset-0 m-auto h-9 w-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-xs transition-all cursor-pointer hover:scale-105 border border-white/20 shadow-md"
                aria-label="Đổi ảnh đại diện"
              >
                {isUploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Camera className="h-4 w-4" />}
              </button>
            </div>

            {/* Thẻ quảng bá Imagine (Theme Adaptive) */}
            <div className="flex-1 flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-muted/50 dark:bg-neutral-900/80 border border-border/80 shadow-xs min-w-0 transition-colors">
              <div className="space-y-0.5 min-w-0 pr-2">
                <h4 className="text-xs sm:text-sm font-bold text-foreground truncate">Edit your photo with Imagine</h4>
                <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Customize yourself in seconds</p>
              </div>

              <button
                type="button"
                onClick={handleGenerateImagineAvatar}
                className="rounded-full border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground px-3 sm:px-3.5 py-1.5 flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors shadow-xs"
              >
                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Edit Photo</span>
              </button>
            </div>
          </div>

          {/* 4. Các Ô Nhập Liệu Floating-Label Chuẩn X (Theme Adaptive) */}
          <div className="px-4 pb-6 space-y-4">
            {/* Name Input */}
            <div className="group relative rounded-xl border border-input focus-within:border-primary focus-within:ring-1 focus-within:ring-primary bg-background/50 hover:border-foreground/25 px-3.5 pt-2 pb-1.5 transition-all">
              <div className="flex items-center justify-between">
                <label htmlFor="name" className="block text-[11px] font-medium text-muted-foreground group-focus-within:text-primary transition-colors">
                  Name
                </label>
                <span className="text-[11px] text-muted-foreground/80 font-mono hidden group-focus-within:inline-block">{displayName.length} / 50</span>
              </div>
              <input
                id="name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
                placeholder="Họ và tên hiển thị"
                className="w-full bg-transparent p-0 text-sm sm:text-base text-foreground focus:outline-none border-none placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Bio Textarea */}
            <div className="group relative rounded-xl border border-input focus-within:border-primary focus-within:ring-1 focus-within:ring-primary bg-background/50 hover:border-foreground/25 px-3.5 pt-2 pb-2 transition-all min-h-[90px]">
              <div className="flex items-center justify-between">
                <label htmlFor="bio" className="block text-[11px] font-medium text-muted-foreground group-focus-within:text-primary transition-colors">
                  Bio
                </label>
                <span className="text-[11px] text-muted-foreground/80 font-mono hidden group-focus-within:inline-block">{bio.length} / 250</span>
              </div>
              <textarea
                id="bio"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={250}
                placeholder="Giới thiệu bản thân..."
                className="w-full bg-transparent p-0 text-sm text-foreground focus:outline-none border-none resize-none placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Location Input */}
            <div className="group relative rounded-xl border border-input focus-within:border-primary focus-within:ring-1 focus-within:ring-primary bg-background/50 hover:border-foreground/25 px-3.5 pt-2 pb-1.5 transition-all">
              <label htmlFor="location" className="block text-[11px] font-medium text-muted-foreground group-focus-within:text-primary transition-colors">
                Location
              </label>
              <input
                id="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Phenikaa University, Hà Nội"
                className="w-full bg-transparent p-0 text-sm sm:text-base text-foreground focus:outline-none border-none placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Website Input */}
            <div className="group relative rounded-xl border border-input focus-within:border-primary focus-within:ring-1 focus-within:ring-primary bg-background/50 hover:border-foreground/25 px-3.5 pt-2 pb-1.5 transition-all">
              <label htmlFor="website" className="block text-[11px] font-medium text-muted-foreground group-focus-within:text-primary transition-colors">
                Website
              </label>
              <input
                id="website"
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://..."
                className="w-full bg-transparent p-0 text-sm sm:text-base text-foreground focus:outline-none border-none placeholder:text-muted-foreground/50"
              />
            </div>

            {/* 5. Cây Đơn vị đào tạo chuẩn hóa (School • Faculty • Major • Cohort • Class) */}
            <AcademicUnitSelector
              school={school}
              faculty={faculty}
              major={major}
              academicYear={academicYear}
              className={className}
              onChange={(values) => {
                setSchool(values.school || '')
                setFaculty(values.faculty || '')
                setMajor(values.major || '')
                setAcademicYear(values.academicYear || '')
                setClassName(values.className || '')
                if (values.unitId !== undefined) setUnitId(values.unitId)
              }}
            />

            {/* 5. Hàng Birth Date (Theme Adaptive & Tương Tác Chọn Ngày) */}
            <div className="pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setIsEditingBirthDate(!isEditingBirthDate)}
                className="w-full flex items-center justify-between py-2 text-left group cursor-pointer hover:bg-muted/50 rounded-xl px-2.5 transition-colors"
                aria-expanded={isEditingBirthDate}
              >
                <div>
                  <span className="block text-xs text-muted-foreground font-normal">Birth date</span>
                  <span className="text-sm font-medium text-foreground">{formatBirthDate(birthDate)}</span>
                </div>
                <ChevronRight
                  className={cn(
                    'h-4 w-4 text-muted-foreground group-hover:text-foreground transition-transform duration-200',
                    isEditingBirthDate && 'rotate-90 text-foreground'
                  )}
                />
              </button>

              {isEditingBirthDate && (
                <div className="mt-2 p-3 bg-muted/40 rounded-xl border border-border flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                  <input
                    type="date"
                    value={/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? birthDate : ''}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="bg-background text-foreground text-xs sm:text-sm rounded-lg px-3 py-1.5 border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setIsEditingBirthDate(false)}
                    className="text-xs text-primary hover:underline font-semibold cursor-pointer flex items-center gap-1"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Xong</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
