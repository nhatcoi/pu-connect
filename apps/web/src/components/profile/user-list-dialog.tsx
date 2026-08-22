'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { FollowButton } from './follow-button'
import { graphqlClient } from '@/lib/graphql-client'
import { Loader2, Users, GraduationCap, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

interface UserListItem {
  id: string
  displayName: string
  username: string
  avatarUrl?: string | null
  role: string
  faculty?: string | null
  reputationPoints: number
  isFollowedByMe?: boolean
}

interface UserListDialogProps {
  userId: string
  username: string
  type: 'followers' | 'following'
  open: boolean
  onOpenChange: (open: boolean) => void
}

const GET_FOLLOWERS_QUERY = `
  query GetFollowers($userId: ID!) {
    userFollowers(userId: $userId) {
      id
      displayName
      username
      avatarUrl
      role
      faculty
      reputationPoints
      isFollowedByMe
    }
  }
`

const GET_FOLLOWING_QUERY = `
  query GetFollowing($userId: ID!) {
    userFollowing(userId: $userId) {
      id
      displayName
      username
      avatarUrl
      role
      faculty
      reputationPoints
      isFollowedByMe
    }
  }
`

export function UserListDialog({
  userId,
  username,
  type,
  open,
  onOpenChange
}: UserListDialogProps) {
  const [users, setUsers] = useState<UserListItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const title = type === 'followers' ? 'Người theo dõi' : 'Đang theo dõi'

  useEffect(() => {
    if (!open || !userId) return

    const fetchUsers = async () => {
      setIsLoading(true)
      try {
        const query = type === 'followers' ? GET_FOLLOWERS_QUERY : GET_FOLLOWING_QUERY
        const data = await graphqlClient<{
          userFollowers?: UserListItem[]
          userFollowing?: UserListItem[]
        }>(query, { userId })

        const list = type === 'followers' ? data?.userFollowers : data?.userFollowing
        setUsers(list || [])
      } catch {
        setUsers([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchUsers()
  }, [open, userId, type])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border-border bg-card">
        <DialogHeader className="p-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <Users className="h-4 w-4 text-primary" />
            <span>
              {title} của @{username}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto divide-y divide-border/40">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : users.length > 0 ? (
            users.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3.5 hover:bg-muted/30 transition-colors"
              >
                <Link
                  href={`/${item.username}`}
                  onClick={() => onOpenChange(false)}
                  className="flex items-center gap-3 min-w-0 flex-1 group"
                >
                  <Avatar className="h-10 w-10 border border-border shrink-0">
                    <AvatarImage
                      src={
                        item.avatarUrl ||
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.username}`
                      }
                      alt={item.displayName}
                    />
                    <AvatarFallback>{item.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                        {item.displayName}
                      </span>
                      {item.role === 'lecturer' && (
                        <ShieldCheck className="h-3.5 w-3.5 text-accent shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
                      <span>@{item.username}</span>
                      {item.faculty && (
                        <>
                          <span>•</span>
                          <span className="truncate">{item.faculty}</span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>

                <div className="shrink-0 ml-2">
                  <FollowButton
                    targetUserId={item.id}
                    targetUsername={item.username}
                    initialIsFollowing={item.isFollowedByMe || false}
                    size="sm"
                    showIcon={false}
                    className="h-7 px-3 text-[11px]"
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-muted-foreground text-xs space-y-1">
              <Users className="h-8 w-8 mx-auto opacity-30 mb-2" />
              <p className="font-medium">Chưa có người dùng nào</p>
              <p className="text-[11px] opacity-80">
                {type === 'followers'
                  ? 'Chưa có ai theo dõi tài khoản này.'
                  : 'Tài khoản này chưa theo dõi ai.'}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
