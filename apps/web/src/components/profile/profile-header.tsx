'use client'

import { useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  MapPin,
  IdCard,
  GraduationCap,
  Sparkles,
  UserPlus,
  Check,
  Edit3,
  Mail
} from 'lucide-react'
import { useAppStore } from '@/store'
import type { UserProfileData } from '@/hooks/use-profile'
import { toast } from 'sonner'

interface ProfileHeaderProps {
  profile: UserProfileData
}

export function ProfileHeader({ profile }: ProfileHeaderProps) {
  const currentUser = useAppStore((state) => state.user)
  const isOwnProfile =
    currentUser?.username?.toLowerCase() === profile.username?.toLowerCase() ||
    currentUser?.id === profile.id

  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(profile.followersCount || 142)

  const handleToggleFollow = () => {
    if (isFollowing) {
      setIsFollowing(false)
      setFollowerCount((prev) => Math.max(0, prev - 1))
      toast.success(`Đã hủy theo dõi @${profile.username}`)
    } else {
      setIsFollowing(true)
      setFollowerCount((prev) => prev + 1)
      toast.success(`Đã theo dõi @${profile.username}`)
    }
  }

  const initials = (profile.displayName || profile.username || 'PU')
    .slice(0, 2)
    .toUpperCase()

  const formattedDate = profile.createdAt
    ? new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(
        new Date(profile.createdAt)
      )
    : 'tháng 08/2026'

  return (
    <div className="border-b border-border bg-card">
      {/* Cover Image Banner */}
      <div className="relative h-36 sm:h-44 w-full bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full text-xs text-white/90 border border-white/10 font-medium">
          <GraduationCap className="h-3.5 w-3.5 text-primary" />
          <span>Phenikaa University</span>
        </div>
      </div>

      {/* Profile Info Container */}
      <div className="px-4 sm:px-5 pb-5">
        {/* Avatar & Action Button Row */}
        <div className="flex justify-between items-end -mt-12 sm:-mt-14 mb-3">
          <Avatar className="h-24 w-24 sm:h-28 sm:w-28 rounded-full border-4 border-card shadow-lg bg-muted ring-2 ring-primary/20">
            <AvatarImage src={profile.avatarUrl || ''} alt={profile.displayName} />
            <AvatarFallback className="bg-primary/20 text-primary font-bold text-xl sm:text-2xl">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex items-center gap-2">
            {isOwnProfile ? (
              <Button
                variant="outline"
                size="sm"
                className="font-semibold rounded-full border-border hover:bg-muted text-xs h-8"
                onClick={() => toast.info('Tính năng chỉnh sửa hồ sơ đang được hoàn thiện!')}
              >
                <Edit3 className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                Chỉnh sửa hồ sơ
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full h-8 w-8 border-border"
                  onClick={() => toast.info(`Gửi tin nhắn đến ${profile.displayName}`)}
                >
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                <Button
                  size="sm"
                  variant={isFollowing ? 'secondary' : 'default'}
                  className={`font-semibold rounded-full px-4 h-8 text-xs transition-all ${
                    isFollowing
                      ? 'bg-muted text-foreground hover:bg-destructive/10 hover:text-destructive'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
                  onClick={handleToggleFollow}
                >
                  {isFollowing ? (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Đang theo dõi
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3.5 w-3.5 mr-1" />
                      Theo dõi
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Name & Academic Credentials */}
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {profile.displayName}
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

            {/* Reputation Points Badge */}
            <div className="flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full text-xs font-semibold">
              <Sparkles className="h-3 w-3" />
              <span>{profile.reputationPoints || 100} Điểm danh vọng</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
            <span>@{profile.username}</span>
            {profile.studentId && (
              <div className="flex items-center gap-1">
                <IdCard className="h-3.5 w-3.5" />
                <span>Mã SV: {profile.studentId}</span>
              </div>
            )}
            {profile.faculty && (
              <div className="flex items-center gap-1 font-medium text-foreground/80">
                <GraduationCap className="h-3.5 w-3.5 text-primary" />
                <span>Khoa {profile.faculty}</span>
              </div>
            )}
            {profile.academicYear && <span>• {profile.academicYear}</span>}
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
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span>Trường Đại học Phenikaa</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>Tham gia {formattedDate}</span>
          </div>
        </div>

        {/* Follower / Following Stats */}
        <div className="flex items-center gap-4 mt-3 text-xs sm:text-sm">
          <div className="flex items-center gap-1">
            <span className="font-bold text-foreground">
              {profile.followingCount || 86}
            </span>
            <span className="text-muted-foreground">Đang theo dõi</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-bold text-foreground">{followerCount}</span>
            <span className="text-muted-foreground">Người theo dõi</span>
          </div>
        </div>
      </div>
    </div>
  )
}
