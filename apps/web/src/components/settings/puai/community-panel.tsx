'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowUpRight, Loader2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAiSkillActions, useSkillLibrary } from '@/hooks/chat'
import { SettingsGroup } from '../settings-ui'

// Cộng đồng PU AI: lối vào /c/puai + skill được cài nhiều nhất
export function CommunityPanel() {
  const { data, isPending } = useSkillLibrary('')
  const { install } = useAiSkillActions()
  return (
    <>
      <div className="px-4 pb-2 sm:px-5">
        <Link href="/c/puai" className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-primary/10 to-brand-orange/10 p-4 hover:from-primary/15">
          <Users className="h-5 w-5 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Cộng đồng PU AI</span>
            <span className="block text-xs text-muted-foreground">Chia sẻ skill hay, mẹo học với PU AI, góp ý & báo lỗi</span>
          </span>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>
      <SettingsGroup label="Skill nổi bật">
        {isPending ? (
          <Loader2 className="mx-auto my-4 h-4 w-4 animate-spin text-muted-foreground" />
        ) : data?.length ? (
          data.slice(0, 5).map((s) => (
            <div key={s.id} className="flex items-center gap-2 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{s.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  /{s.slug} · {s.author.displayName} · {s.installCount} lượt cài
                </span>
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 rounded-full text-xs"
                disabled={s.installed || install.isPending}
                onClick={() => install.mutate(s.id)}
              >
                {s.installed ? 'Đã cài' : 'Cài'}
              </Button>
            </div>
          ))
        ) : (
          <p className="py-4 text-center text-xs text-muted-foreground">Chưa có skill công khai — hãy là người đầu tiên chia sẻ!</p>
        )}
      </SettingsGroup>
    </>
  )
}
