'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/auth/auth-guard'
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
  ShieldCheck,
  Laptop,
  Cpu,
  Zap,
  Car,
  TrendingUp,
  Languages,
  Stethoscope,
  FlaskConical,
  CheckCircle2
} from 'lucide-react'
import type { UserProfile } from '@pu/schemas'

interface FacultyOption {
  code: string
  name: string
  Icon: React.ComponentType<{ className?: string }>
}

const FACULTIES: FacultyOption[] = [
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

export default function GetStartedPage() {
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
  const [isTransitioning, setIsTransitioning] = useState(false)

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
        setIsTransitioning(true)
        toast.success('Hồ sơ học thuật đã sẵn sàng! Nhận ngay +100 Điểm danh vọng')
        setTimeout(() => {
          router.replace('/home')
        }, 800)
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

  if (isTransitioning) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="h-16 w-16 rounded-3xl bg-primary/15 text-primary flex items-center justify-center shadow-lg animate-bounce">
            <Sparkles className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-lg font-black text-foreground">Đang thiết lập Bảng tin Phenikaa</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Đang cá nhân hóa đề thi, bài tập và nhóm đồ án theo Khoa {faculty}...
            </p>
          </div>
          <Loader2 className="h-5 w-5 animate-spin text-primary mt-2" />
        </div>
      </div>
    )
  }

  return (
    <AuthGuard requireOnboarded={false}>
      <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-primary selection:text-primary-foreground relative overflow-hidden">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        {/* Top Minimal Brand Bar */}
        <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-black text-base shadow-md">
              PU
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-foreground">
                PU Connector
              </span>
              <span className="text-[10px] text-muted-foreground block -mt-1 font-medium">
                Phenikaa University Academic Social Network
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-full border border-border">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Đang đăng nhập: <strong>{user?.displayName || `@${user?.username}`}</strong></span>
          </div>
        </header>

        {/* Main Center Get-Started Card */}
        <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            
            {/* Step Stepper Header */}
            <div className="bg-primary/10 px-6 sm:px-8 pt-7 pb-5 border-b border-border/60">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h2 className="font-bold text-base tracking-tight text-foreground">
                    Khởi Tạo Hồ Sơ Tân Sinh Viên
                  </h2>
                </div>
                <span className="text-xs font-bold text-primary bg-primary/15 px-3 py-0.5 rounded-full border border-primary/20">
                  Bước {step} / 4
                </span>
              </div>

              {/* Stepper Progress Indicator */}
              <div className="grid grid-cols-4 gap-2.5">
                {[1, 2, 3, 4].map((s) => (
                  <div
                    key={s}
                    className={`h-2 rounded-full transition-all duration-500 ${
                      s <= step ? 'bg-primary shadow-xs' : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Step Body */}
            <div className="p-6 sm:p-8 flex-1 overflow-y-auto max-h-[60vh]">
              {/* STEP 1: Academic Identity */}
              {step === 1 && (
                <div className="space-y-5 animate-in fade-in duration-300">
                  <div>
                    <h3 className="text-xl font-extrabold tracking-tight text-foreground">
                      Xác thực danh tính Phenikaa
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cung cấp mã sinh viên và Khoa/Viện để hệ thống mở khóa đúng các môn học và phân hệ chuyên ngành.
                    </p>
                  </div>

                  <div className="space-y-4 pt-1">
                    <div>
                      <label className="text-xs font-bold text-foreground flex items-center gap-1.5 mb-2">
                        <GraduationCap className="h-4 w-4 text-primary" />
                        Mã Sinh Viên / Mã Cán Bộ <span className="text-destructive">*</span>
                      </label>
                      <Input
                        placeholder="Ví dụ: 22010001"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        className="h-11 text-xs rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-foreground mb-2 block">
                        Khoa / Viện Đào Tạo <span className="text-destructive">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2.5">
                        {FACULTIES.map((f) => {
                          const IconComponent = f.Icon
                          return (
                            <button
                              key={f.code}
                              type="button"
                              onClick={() => setFaculty(f.code)}
                              className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left text-xs transition-all cursor-pointer ${
                                faculty === f.code
                                  ? 'border-primary bg-primary/10 font-bold text-foreground ring-2 ring-primary/40 shadow-xs'
                                  : 'border-border bg-background hover:bg-muted/60 text-muted-foreground'
                              }`}
                            >
                              <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                                faculty === f.code ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                              }`}>
                                <IconComponent className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <span className="block font-bold">{f.code}</span>
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
                      <label className="text-xs font-bold text-foreground mb-2 block">
                        Khóa học / Niên khóa
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {ACADEMIC_YEARS.map((yr) => (
                          <button
                            key={yr}
                            type="button"
                            onClick={() => setAcademicYear(yr)}
                            className={`px-3.5 py-2 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                              academicYear === yr
                                ? 'border-primary bg-primary/10 font-bold text-foreground ring-1 ring-primary'
                                : 'border-border bg-background text-muted-foreground hover:bg-muted/60'
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
                <div className="space-y-5 animate-in fade-in duration-300">
                  <div>
                    <h3 className="text-xl font-extrabold tracking-tight text-foreground">
                      Môn học quan tâm trong kỳ này
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Bảng tin sẽ tự động ưu tiên đề thi, slide bài giảng và câu hỏi thảo luận thuộc các môn bạn chọn.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {AVAILABLE_COURSES.map((course) => {
                      const isSelected = selectedCourses.includes(course.code)
                      return (
                        <button
                          key={course.code}
                          type="button"
                          onClick={() => toggleCourse(course.code)}
                          className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left text-xs transition-all cursor-pointer ${
                            isSelected
                              ? 'border-primary bg-primary/10 font-medium text-foreground ring-2 ring-primary/40 shadow-xs'
                              : 'border-border bg-background hover:bg-muted/60 text-muted-foreground'
                          }`}
                        >
                          <BookOpen
                            className={`h-4 w-4 mt-0.5 shrink-0 ${
                              isSelected ? 'text-primary' : 'text-muted-foreground'
                            }`}
                          />
                          <div className="min-w-0">
                            <span className="font-bold text-foreground block text-xs">
                              {course.code}
                            </span>
                            <span className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mt-0.5">
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
                <div className="space-y-5 animate-in fade-in duration-300">
                  <div>
                    <h3 className="text-xl font-extrabold tracking-tight text-foreground">
                      Kỹ năng & Đồ án PBL
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Chọn công nghệ sở trường để thuật toán AI ghép nhóm đồ án môn học phù hợp nhất cho bạn.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2.5 pt-1">
                    {AVAILABLE_SKILLS.map((skill) => {
                      const isSelected = selectedSkills.includes(skill)
                      return (
                        <Badge
                          key={skill}
                          variant={isSelected ? 'default' : 'outline'}
                          onClick={() => toggleSkill(skill)}
                          className={`text-xs py-2 px-3.5 rounded-xl cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-primary text-primary-foreground font-bold shadow-xs scale-105'
                              : 'hover:bg-muted text-muted-foreground'
                          }`}
                        >
                          <Code2 className="h-3.5 w-3.5 mr-1.5" />
                          {skill}
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* STEP 4: Social Graph & Activation */}
              {step === 4 && (
                <div className="space-y-5 animate-in fade-in duration-300">
                  <div>
                    <h3 className="text-xl font-extrabold tracking-tight text-foreground">
                      Kết nối bạn học & Giảng viên
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Theo dõi những người đầu tiên cùng khoa để kích hoạt Bảng tin học thuật của bạn.
                    </p>
                  </div>

                  {/* Reward Box */}
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3.5">
                    <div className="h-11 w-11 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
                      <Award className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <span>Thưởng chào mừng Tân sinh viên</span>
                        <Sparkles className="h-4 w-4 text-amber-500" />
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
                          className="flex items-center justify-between p-3 rounded-2xl border border-border bg-background"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
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
                            className="h-8 text-xs rounded-full px-4"
                          >
                            {isFollowed ? (
                              <>
                                <Check className="h-3.5 w-3.5 mr-1" />
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

            {/* Step Footer Actions */}
            <div className="bg-muted/30 px-6 sm:px-8 py-5 border-t border-border flex items-center justify-between">
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

              <div className="flex items-center gap-2.5">
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
                    className="text-xs font-bold gap-1.5 rounded-xl px-5 h-10 shadow-xs"
                  >
                    <span>Tiếp tục</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleFinishOnboarding}
                    disabled={isSubmitting}
                    className="text-xs font-bold gap-2 rounded-xl px-6 h-10 bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>Hoàn tất & Khám phá</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Bottom Footer */}
        <footer className="relative z-10 py-4 text-center text-xs text-muted-foreground border-t border-border/40">
          Trường Đại học Phenikaa • Nền tảng PU Connector © 2026
        </footer>
      </div>
    </AuthGuard>
  )
}
