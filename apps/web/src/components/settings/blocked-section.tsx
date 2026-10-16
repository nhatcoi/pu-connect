'use client'

import React from 'react'
import Link from 'next/link'
import { Loader2, ShieldCheck } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { UserListSkeleton } from '@/components/skeletons/user-row-skeleton'
import { useBlockActions, useBlockedUsers } from '@/hooks/use-blocks'
import { SettingsGroup } from './settings-ui'

// Chặn & An toàn: danh sách tài khoản đã chặn + bỏ chặn
export function BlockedSection() {
  const { data: users, isPending } = useBlockedUsers(true)
  const { unblock } = useBlockActions()

  return (
    <SettingsGroup
      label="Tài khoản đã chặn"
      hint="Người bị chặn không xem được hồ sơ, bài viết của bạn và không nhắn tin được cho bạn. Chặn ai đó từ trang hồ sơ của họ."
    >
      {isPending ? (
        <UserListSkeleton count={3} label="Đang tải danh sách chặn" rowClassName="px-0" action />
      ) : !users?.length ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/70">
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
          </span>
          <p className="text-[13px] font-medium">Bạn chưa chặn ai</p>
        </div>
      ) : (
        users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 py-2.5">
            <Avatar className="h-9 w-9">
              <AvatarImage src={u.avatarUrl || ''} alt={u.displayName} />
              <AvatarFallback className="text-[11px]">{u.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <Link href={`/${u.username}`} className="min-w-0 flex-1 hover:underline">
              <p className="truncate text-[13px] font-semibold">{u.displayName}</p>
              <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
            </Link>
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-full px-3.5 text-xs"
              disabled={unblock.isPending && unblock.variables === u.id}
              onClick={() => unblock.mutate(u.id)}
            >
              {unblock.isPending && unblock.variables === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Bỏ chặn'}
            </Button>
          </div>
        ))
      )}
    </SettingsGroup>
  )
}
