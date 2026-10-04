'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store'
import { graphqlClient } from '@/lib/graphql-client'
import { UserPlus, UserCheck, UserX, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FollowButtonProps {
  targetUserId: string
  targetUsername?: string
  initialIsFollowing?: boolean
  onFollowChange?: (isFollowing: boolean, followersCount?: number) => void
  size?: 'sm' | 'default' | 'lg'
  variant?: 'default' | 'outline' | 'secondary'
  className?: string
  showIcon?: boolean
}

const TOGGLE_FOLLOW_MUTATION = `
  mutation ToggleFollow($targetUserId: ID!) {
    toggleFollow(targetUserId: $targetUserId) {
      isFollowing
      followersCount
      followingCount
    }
  }
`

export function FollowButton({
  targetUserId,
  targetUsername,
  initialIsFollowing = false,
  onFollowChange,
  size = 'default',
  variant = 'default',
  className,
  showIcon = true
}: FollowButtonProps) {
  const currentUser = useAppStore((state) => state.user)
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [isHovered, setIsHovered] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setIsFollowing(initialIsFollowing)
  }, [initialIsFollowing])

  // Không hiển thị nút follow nếu là chính mình
  const isMe =
    (currentUser?.id && currentUser.id === targetUserId) ||
    (currentUser?.username && targetUsername && currentUser.username === targetUsername)

  if (isMe) {
    return null
  }

  const handleToggleFollow = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!currentUser) {
      alert('Vui lòng đăng nhập để theo dõi người dùng này!')
      return
    }

    const previousState = isFollowing
    const nextState = !previousState

    // 1. Optimistic Update tức thì
    setIsFollowing(nextState)
    if (onFollowChange) {
      onFollowChange(nextState)
    }

    setIsLoading(true)
    try {
      const data = await graphqlClient<{
        toggleFollow: {
          isFollowing: boolean
          followersCount: number
          followingCount: number
        }
      }>(TOGGLE_FOLLOW_MUTATION, { targetUserId })

      if (data && data.toggleFollow) {
        setIsFollowing(data.toggleFollow.isFollowing)
        if (onFollowChange) {
          onFollowChange(data.toggleFollow.isFollowing, data.toggleFollow.followersCount)
        }
      }
    } catch {
      // Rollback nếu có lỗi
      setIsFollowing(previousState)
      if (onFollowChange) {
        onFollowChange(previousState)
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (isFollowing) {
    return (
      <Button
        variant="outline"
        size={size}
        onClick={handleToggleFollow}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={isLoading}
        className={cn(
          'rounded-full font-semibold transition-all duration-200 min-w-[110px] text-xs',
          isHovered
            ? 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive'
            : 'border-border bg-background text-foreground hover:bg-muted',
          className
        )}
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
        ) : isHovered ? (
          <>
            {showIcon && <UserX className="h-3.5 w-3.5 mr-1.5 text-destructive" />}
            <span>Hủy theo dõi</span>
          </>
        ) : (
          <>
            {showIcon && <UserCheck className="h-3.5 w-3.5 mr-1.5 text-primary" />}
            <span>Đang theo dõi</span>
          </>
        )}
      </Button>
    )
  }

  return (
    <Button
      variant="default"
      size={size}
      onClick={handleToggleFollow}
      disabled={isLoading}
      className={cn(
        'rounded-full font-semibold transition-all duration-200 min-w-[100px] text-xs shadow-xs hover:shadow-sm',
        // Outline navy: dùng ở danh sách gợi ý cho nhẹ mắt
        variant === 'outline' && 'bg-transparent border border-primary text-primary hover:bg-primary/10 shadow-none hover:shadow-none',
        className
      )}
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
      ) : (
        <>
          {showIcon && <UserPlus className="h-3.5 w-3.5 mr-1.5" />}
          <span>Theo dõi</span>
        </>
      )}
    </Button>
  )
}
