'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAppStore } from '@/store'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import {
  GraduationCap,
  BookOpen,
  Code2,
  Users,
  Sparkles,
  ArrowRight,
  Check,
  Award,
  Loader2,
  Laptop,
  Cpu,
  Zap,
  Car,
  TrendingUp,
  Languages,
  Stethoscope,
  FlaskConical
} from 'lucide-react'
import type { UserProfile } from '@pu/schemas'

const FACULTIES = [
  { code: 'FIT', name: 'Công nghệ thông tin', Icon: Laptop },
  { code: 'FCS', name: 'Khoa học Máy tính & AI', Icon: Cpu },
  { code: 'FEE', name: 'Điện - Điện tử & Tự động hóa', Icon: Zap },
  { code: 'FAE', name: 'Kỹ thuật Ô tô & Xe tự hành', Icon: Car },
  { code: 'FBA', name: 'Kinh tế & Quản trị Kinh doanh', Icon: TrendingUp },
  { code: 'FEL', name: 'Ngôn ngữ & Ngoại ngữ', Icon: Languages },
  { code: 'FMS', name: 'Khối ngành Sức khỏe & Y Dược', Icon: Stethoscope },
  { code: 'FAS', name: 'Khoa học & Kỹ thuật Vật liệu', Icon: FlaskConical }
]

const ACADEMIC_YEARS = [
  'K15 (2021-2025)',
  'K16 (2022-2026)',
  'K17 (2023-2027)',
  'K18 (2024-2028)',
  'Giảng viên / Cán bộ'
]

const AVAILABLE_COURSES = [
  { code: 'IT101', name: 'Cấu trúc dữ liệu & Giải thuật', faculty: 'FIT' },
  { code: 'MATH201', name: 'Giải tích 2', faculty: 'ALL' },
  { code: 'PHY102', name: 'Vật lý đại cương', faculty: 'ALL' },
  { code: 'AI302', name: 'Học máy cơ bản (Machine Learning)', faculty: 'FCS' },
  { code: 'FEE101', name: 'Mạch điện & Hệ thống nhúng', faculty: 'FEE' },
  { code: 'FAE201', name: 'Cơ điện tử ô tô & Xe điện EV', faculty: 'FAE' },
  { code: 'FBA101', name: 'Marketing số & Thương mại điện tử', faculty: 'FBA' },
  { code: 'FEL101', name: 'Tiếng Anh học thuật & IELTS Zone', faculty: 'FEL' }
]

const AVAILABLE_SKILLS = [
  'Next.js',
  'React Native',
  'NestJS',
  'Python AI',
  'Figma UI/UX',
  'PyTorch',
  'Matlab Simulink',
  'ROS 2 / Robot',
  'Docker & DevOps',
  'IELTS 7.0+',
  'Data Analytics',
  'AutoCAD'
]

const SUGGESTED_MENTORS = [
  {
    id: 'gv_nguyenvanha',
    name: 'TS. Nguyễn Văn Hà',
    role: 'Giảng viên Khoa CNTT',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=GVHa',
    faculty: 'FIT'
  },
  {
    id: 'tranminhduc',
    name: 'Trần Minh Đức',
    role: 'K16 CNTT (Fullstack Dev)',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Duc',
    faculty: 'FIT'
  },
  {
    id: 'lethimai',
    name: 'Lê Thị Mai',
    role: 'K16 CNTT (CLB Tin học)',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mai',
    faculty: 'FIT'
  },
  {
    id: 'hoangthuytrang',
    name: 'Hoàng Thùy Trang',
    role: 'K16 CNTT (Data Science)',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Trang',
    faculty: 'FIT'
  }
]

interface OnboardingModalProps {
  open: boolean
  onComplete?: () => void
}

export function OnboardingModal({ open, onComplete }: OnboardingModalProps) {
  const router = useRouter()
  const user = useAppStore((state) => state.user)
  const setUser = useAppStore((state) => state.setUser)
  const logout = useAppStore((state) => state.logout)

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [studentId, setStudentId] = useState(user?.studentId || '')
  const [faculty, setFaculty] = useState(user?.faculty || 'FIT')
  const [academicYear, setAcademicYear] = useState(user?.academicYear || 'K16 (2022-2026)')
  const [bio, setBio] = useState(user?.bio || '')
  const [selectedCourses, setSelectedCourses] = useState<string[]>(['IT101', 'MATH201'])
  const [selectedSkills, setSelectedSkills] = useState<string[]>(['Next.js', 'React Native'])
  const [selectedFollows, setSelectedFollows] = useState<string[]>(
    SUGGESTED_MENTORS.map((m) => m.id)
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const toggleCourse = (code: string) => {
    setSelectedCourses((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    )
  }

  const toggleFollow = (id: string) => {
    setSelectedFollows((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    )
  }

  const handleFinishOnboarding = async () => {
    setIsSubmitting(true)
    try {
      const res = await apiClient<{ success: boolean; data: UserProfile }>(
        '/auth/onboarding',
        {
          method: 'POST',
          body: JSON.stringify({
            studentId: studentId.trim() || '22010099',
            faculty,
            academicYear,
            bio: bio.trim() || undefined,
            courses: selectedCourses,
            skills: selectedSkills,
            followUserIds: selectedFollows
          })
        }
      )

      if (res && res.data) {
        setUser(res.data)
        toast.success('Hồ sơ học thuật đã sẵn sàng! Nhận ngay +100 Điểm danh vọng 🎉')
        if (onComplete) onComplete()
      }
    } catch (err: any) {
      if (err.message && err.message.includes('đăng nhập')) {
        toast.error('Phiên đăng nhập đã hết hạn. Đang chuyển hướng về trang đăng nhập...')
        logout()
        router.replace('/')
      } else {
        toast.error(err.message || 'Không thể lưu hồ sơ khởi tạo')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-xl p-0 gap-0 overflow-hidden border-border bg-card shadow-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Progress Bar & Header */}
        <div className="bg-primary/10 px-6 pt-6 pb-4 border-b border-border/60">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-black text-xs">
                PU
              </div>
              <span className="font-bold text-sm tracking-tight text-foreground">
                Thiết Lập Hồ Sơ Học Thuật
              </span>
            </div>
            <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
              Bước {step} / 4
            </span>
          </div>

          {/* Stepper Progress Indicator */}
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s <= step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* STEP 1: Academic Identity */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Xác thực danh tính Phenikaa
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Vui lòng cung cấp mã sinh viên và Khoa/Viện để cá nhân hóa bảng tin học thuật.
                </DialogDescription>
              </div>

              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                    <GraduationCap className="h-3.5 w-3.5 text-primary" />
                    Mã Sinh Viên / Mã Cán Bộ <span className="text-destructive">*</span>
                  </label>
                  <Input
                    placeholder="Ví dụ: 22010001"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="h-10 text-xs rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">
                    Khoa / Viện Đào Tạo <span className="text-destructive">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {FACULTIES.map((f) => {
                      const IconComponent = f.Icon
                      return (
                        <button
                          key={f.code}
                          type="button"
                          onClick={() => setFaculty(f.code)}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                            faculty === f.code
                              ? 'border-primary bg-primary/10 font-bold text-foreground ring-1 ring-primary'
                              : 'border-border bg-background hover:bg-muted/50 text-muted-foreground'
                          }`}
                        >
                          <div className={`h-6 w-6 rounded-lg flex items-center justify-center shrink-0 ${
                            faculty === f.code ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                          }`}>
                            <IconComponent className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <span className="block font-semibold">{f.code}</span>
                            <span className="text-[10px] text-muted-foreground truncate block">
                              {f.name}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">
                    Khóa học / Niên khóa
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {ACADEMIC_YEARS.map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => setAcademicYear(yr)}
                        className={`px-3 py-1.5 rounded-xl border text-xs transition-all cursor-pointer ${
                          academicYear === yr
                            ? 'border-primary bg-primary/10 font-bold text-foreground'
                            : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        {yr}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Courses of Interest */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Môn học quan tâm trong kỳ này
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Bảng tin sẽ ưu tiên đề thi, bài tập và câu hỏi thảo luận thuộc các môn bạn chọn.
                </DialogDescription>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {AVAILABLE_COURSES.map((course) => {
                  const isSelected = selectedCourses.includes(course.code)
                  return (
                    <button
                      key={course.code}
                      type="button"
                      onClick={() => toggleCourse(course.code)}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary/10 font-medium text-foreground ring-1 ring-primary'
                          : 'border-border bg-background hover:bg-muted/50 text-muted-foreground'
                      }`}
                    >
                      <BookOpen
                        className={`h-4 w-4 mt-0.5 shrink-0 ${
                          isSelected ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      />
                      <div className="min-w-0">
                        <span className="font-bold text-foreground block">
                          {course.code}
                        </span>
                        <span className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                          {course.name}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Skills & PBL Matching */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Kỹ năng & Đồ án PBL
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Chọn công nghệ sở trường để thuật toán AI ghép nhóm đồ án môn học phù hợp nhất.
                </DialogDescription>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {AVAILABLE_SKILLS.map((skill) => {
                  const isSelected = selectedSkills.includes(skill)
                  return (
                    <Badge
                      key={skill}
                      variant={isSelected ? 'default' : 'outline'}
                      onClick={() => toggleSkill(skill)}
                      className={`text-xs py-1.5 px-3 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                          : 'hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      <Code2 className="h-3 w-3 mr-1.5" />
                      {skill}
                    </Badge>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP 4: Social Graph & Activation */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Kết nối bạn học & Giảng viên
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Theo dõi những người đầu tiên để kích hoạt Bảng tin học thuật của bạn.
                </DialogDescription>
              </div>

              {/* Reward Box */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span>Thưởng chào mừng Tân sinh viên</span>
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Nhận ngay <strong className="text-amber-600 dark:text-amber-400">+100 Điểm danh vọng</strong> sau khi hoàn tất!
                  </p>
                </div>
              </div>

              {/* Mentors / Peers List */}
              <div className="space-y-2 pt-1">
                {SUGGESTED_MENTORS.map((mentor) => {
                  const isFollowed = selectedFollows.includes(mentor.id)
                  return (
                    <div
                      key={mentor.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-background"
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={mentor.avatar} />
                          <AvatarFallback className="text-xs font-bold">PU</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-xs font-bold text-foreground">{mentor.name}</p>
                          <p className="text-[11px] text-muted-foreground">{mentor.role}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={isFollowed ? 'secondary' : 'outline'}
                        onClick={() => toggleFollow(mentor.id)}
                        className="h-7 text-[11px] rounded-full px-3"
                      >
                        {isFollowed ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Đã chọn
                          </>
                        ) : (
                          'Theo dõi'
                        )}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-muted/30 p-4 border-t border-border flex items-center justify-between">
          {step > 1 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep((prev) => (prev - 1) as any)}
              className="text-xs font-semibold"
            >
              Quay lại
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {step === 2 || step === 3 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep((prev) => (prev + 1) as any)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Bỏ qua bước này
              </Button>
            ) : null}

            {step < 4 ? (
              <Button
                size="sm"
                onClick={() => setStep((prev) => (prev + 1) as any)}
                disabled={step === 1 && !studentId.trim()}
                className="text-xs font-bold gap-1 rounded-xl px-4"
              >
                <span>Tiếp tục</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleFinishOnboarding}
                disabled={isSubmitting}
                className="text-xs font-bold gap-1.5 rounded-xl px-5 bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Hoàn tất & Khám phá</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
