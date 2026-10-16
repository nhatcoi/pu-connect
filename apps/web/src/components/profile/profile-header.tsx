'use client'

import { chatApi } from '@/hooks/chat'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  MapPin,
  IdCard,
  GraduationCap,
  Edit3,
  Mail,
  CheckCircle2,
  Settings,
  BookOpen,
  School,
  Globe
} from 'lucide-react'
import { useAppStore } from '@/store'
import type { UserProfileData } from '@/hooks/use-profile'
import { toast } from 'sonner'
import { FollowButton } from './follow-button'
import { UserListDialog } from './user-list-dialog'
import { EditProfileDialog } from './edit-profile-dialog'
import { BlockUserControl } from './block-user-control'

interface ProfileHeaderProps {
  profile: UserProfileData
  onRefetch?: () => void
}

export function ProfileHeader({ profile, onRefetch }: ProfileHeaderProps) {
  const router = useRouter()
  const currentUser = useAppStore((state) => state.user)
  const isOwnProfile =
    currentUser?.username?.toLowerCase() === profile.username?.toLowerCase() ||
    currentUser?.id === profile.id

  const blockState = profile.blockState ?? 'none'
  const [followersCount, setFollowersCount] = useState(profile.followersCount || 0)
  const [followingCount, setFollowingCount] = useState(profile.followingCount || 0)
  const [listDialog, setListDialog] = useState<{
    open: boolean
    type: 'followers' | 'following'
  }>({
    open: false,
    type: 'followers'
  })

  const [isEditOpen, setIsEditOpen] = useState(false)

  // Mở sẵn hộp chỉnh sửa khi vào từ thẻ "Hoàn thiện hồ sơ" (?edit=1)
  const searchParams = useSearchParams()
  useEffect(() => {
    if (isOwnProfile && searchParams.get('edit') === '1') {
      setIsEditOpen(true)
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [isOwnProfile, searchParams])

  const initials = (profile.displayName || profile.username || 'PU')
    .slice(0, 2)
    .toUpperCase()

  const formattedDate = profile.createdAt
    ? new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(
        new Date(profile.createdAt)
      )
    : 'tháng 08/2026'

  return (
    <div className="bg-card">
      {/* User Followers / Following Dialog */}
      <UserListDialog
        userId={profile.id}
        username={profile.username}
        type={listDialog.type}
        open={listDialog.open}
        onOpenChange={(open) => setListDialog((prev) => ({ ...prev, open }))}
      />

      {/* Edit Profile Dialog */}
      <EditProfileDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        initialData={{
          displayName: profile.displayName,
          bio: profile.bio,
          school: profile.school,
          faculty: profile.faculty,
          major: profile.major,
          academicYear: profile.academicYear,
          className: profile.className,
          avatarUrl: profile.avatarUrl,
          bannerUrl: profile.bannerUrl,
          location: profile.location,
          website: profile.website,
          birthDate: profile.birthDate
        }}
        onSuccess={() => {
          if (onRefetch) onRefetch()
        }}
      />

      {/* Cover Image Banner */}
      <div className="relative h-36 sm:h-44 w-full bg-gradient-to-br from-[#0B3D91] via-[#0A3380] to-[#072A6B] overflow-hidden">
        {profile.bannerUrl && (
          <img
            src={profile.bannerUrl}
            alt="Cover banner"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full text-xs text-white/90 border border-white/10 font-medium z-10">
          <GraduationCap className="h-3.5 w-3.5 text-primary" />
          <span>Phenikaa University</span>
        </div>
      </div>

      {/* Profile Info Container */}
      <div className="px-4 sm:px-5 pb-5">
        {/* Avatar & Action Button Row */}
        <div className="flex justify-between items-end -mt-12 sm:-mt-14 mb-3">
          <div className="relative">
            <Avatar className="h-24 w-24 sm:h-28 sm:w-28 rounded-full border-4 border-card shadow-lg bg-muted ring-2 ring-primary/20">
              <AvatarImage src={profile.avatarUrl || ''} alt={profile.displayName} />
              <AvatarFallback className="bg-primary/20 text-primary font-bold text-xl sm:text-2xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            {profile.isVerified && (
              <div
                className="absolute bottom-1 right-1 bg-card rounded-full p-0.5 shadow-md"
                title="Tài khoản sinh viên chính quy Phenikaa đã xác thực"
              >
                <CheckCircle2 className="h-5 w-5 text-blue-500 fill-blue-500/20" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isOwnProfile ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="font-semibold rounded-full border-border hover:bg-muted text-xs h-8"
                  onClick={() => setIsEditOpen(true)}
                >
                  <Edit3 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  Chỉnh sửa hồ sơ
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => router.push('/settings')}
                  title="Cài đặt"
                  aria-label="Cài đặt"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </>
            ) : blockState !== 'none' ? (
              // Có quan hệ chặn: không nhắn tin / theo dõi
              <BlockUserControl userId={profile.id} username={profile.username} blockState={blockState} />
            ) : (
              <>
                <BlockUserControl userId={profile.id} username={profile.username} blockState={blockState} />
                {/* Nhắn tin: mở (hoặc tạo) DM rồi chuyển sang /messages/{id} */}
                <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full h-8 w-8 border-border"
                    title={`Nhắn tin cho ${profile.displayName}`}
                    onClick={async () => {
                      try {
                        const conv = await chatApi.openDirect(profile.id)
                        router.push(`/messages/${conv.id}`)
                      } catch (err: any) {
                        toast.error(err?.message || 'Không thể mở hội thoại')
                      }
                    }}
                  >
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                <FollowButton
                  targetUserId={profile.id}
                  targetUsername={profile.username}
                  initialIsFollowing={profile.isFollowedByMe || false}
                  onFollowChange={(isFollowing, newFollowersCount) => {
                    if (typeof newFollowersCount === 'number') {
                      setFollowersCount(newFollowersCount)
                    } else {
                      setFollowersCount((prev) => (isFollowing ? prev + 1 : Math.max(0, prev - 1)))
                    }
                  }}
                  size="sm"
                  className="h-8 text-xs px-4"
                />
              </>
            )}
          </div>
        </div>

        {/* Name & Academic Credentials */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-1.5">
              <span>{profile.displayName}</span>
              {profile.isVerified && (
                <span title="Tích Xanh sinh viên chính quy Phenikaa">
                  <CheckCircle2 className="h-4 w-4 text-blue-500 fill-blue-500/20 shrink-0" />
                </span>
              )}
            </h1>

            {profile.role === 'lecturer' ? (
              <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-[11px] font-medium py-0">
                Giảng viên
              </Badge>
            ) : profile.role === 'admin' ? (
              <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 text-[11px] font-medium py-0">
                Quản trị viên
              </Badge>
            ) : (
              <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[11px] font-medium py-0">
                Sinh viên
              </Badge>
            )}
          </div>

          {/* Academic Info Hierarchy: School, Khoa, Major, Class, Year, MSSV */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/90">@{profile.username}</span>

            {profile.studentId && (
              <div className="flex items-center gap-1">
                <IdCard className="h-3.5 w-3.5 text-muted-foreground" />
                <span>MSSV: {profile.studentId}</span>
              </div>
            )}

            {profile.school && (
              <div className="flex items-center gap-1 font-medium text-foreground/85">
                <School className="h-3.5 w-3.5 text-primary" />
                <span>{profile.school}</span>
              </div>
            )}

            {profile.faculty && profile.faculty !== profile.school && (
              <div className="flex items-center gap-1 font-medium text-foreground/80">
                <GraduationCap className="h-3.5 w-3.5 text-primary" />
                <span>{profile.faculty.startsWith('Khoa') || profile.faculty.startsWith('Viện') || profile.faculty.startsWith('Trung tâm') ? profile.faculty : `Khoa ${profile.faculty}`}</span>
              </div>
            )}

            {profile.major && (
              <div className="flex items-center gap-1 font-medium text-primary">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
                <span>{profile.major}</span>
              </div>
            )}

            {profile.className && (
              <div className="flex items-center gap-1">
                <School className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Lớp {profile.className}</span>
              </div>
            )}

            {profile.academicYear && <span>• Khóa {profile.academicYear}</span>}
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="mt-2.5 text-xs sm:text-sm text-foreground/90 leading-relaxed">
            {profile.bio}
          </p>
        )}

        {/* Metadata Details */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs text-muted-foreground">
          {profile.location && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span>{profile.location}</span>
            </div>
          )}
          {profile.website && (
            <div className="flex items-center gap-1">
              <Globe className="h-3 w-3 text-primary" />
              <a
                href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline truncate max-w-[200px]"
              >
                {profile.website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>Tham gia {formattedDate}</span>
          </div>
        </div>

        {/* Follower / Following Stats (Clickable) */}
        <div className="flex items-center gap-5 mt-3 text-xs sm:text-sm">
          <button
            type="button"
            onClick={() => setListDialog({ open: true, type: 'following' })}
            className="flex items-center gap-1.5 hover:underline cursor-pointer group"
          >
            <span className="font-bold text-foreground group-hover:text-primary transition-colors">
              {followingCount}
            </span>
            <span className="text-muted-foreground">Đang theo dõi</span>
          </button>
          <button
            type="button"
            onClick={() => setListDialog({ open: true, type: 'followers' })}
            className="flex items-center gap-1.5 hover:underline cursor-pointer group"
          >
            <span className="font-bold text-foreground group-hover:text-primary transition-colors">
              {followersCount}
            </span>
            <span className="text-muted-foreground">Người theo dõi</span>
          </button>
        </div>
      </div>
    </div>
  )
}
