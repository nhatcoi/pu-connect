'use client'

import React from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { UserListSkeleton } from '@/components/skeletons/user-row-skeleton'
import { useBlockActions, useBlockedUsers } from '@/hooks/use-blocks'

// Danh sách tài khoản mình đã chặn (trong Cài đặt quyền riêng tư)
export function BlockedUsersSection({ enabled }: { enabled: boolean }) {
  const { data: users, isPending } = useBlockedUsers(enabled)
  const { unblock } = useBlockActions()

  return (
    <div className="space-y-2.5 pt-1 border-t border-border/60">
      <h4 className="pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tài khoản đã chặn</h4>
      {isPending ? (
        <UserListSkeleton count={2} label="Đang tải danh sách chặn" rowClassName="px-0" action />
      ) : !users?.length ? (
        <p className="text-[11px] text-muted-foreground">Bạn chưa chặn ai.</p>
      ) : (
        <ul className="max-h-48 overflow-y-auto space-y-1">
          {users.map((u) => (
            <li key={u.id} className="flex items-center gap-2.5 py-1.5">
              <Avatar className="h-8 w-8">
                <AvatarImage src={u.avatarUrl || ''} alt={u.displayName} />
                <AvatarFallback className="text-[11px]">{u.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <Link href={`/${u.username}`} className="min-w-0 flex-1 hover:underline">
                <p className="truncate text-xs font-semibold text-foreground">{u.displayName}</p>
                <p className="truncate text-[11px] text-muted-foreground">@{u.username}</p>
              </Link>
              <Button
                size="sm"
                variant="outline"
                className="h-7 rounded-full text-xs"
                disabled={unblock.isPending && unblock.variables === u.id}
                onClick={() => unblock.mutate(u.id)}
              >
                {unblock.isPending && unblock.variables === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Bỏ chặn'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
