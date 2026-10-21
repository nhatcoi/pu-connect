'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowUpRight, Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { SkillLibraryRow } from '@/components/chat/composer/skill-library-row'
import { useAiSkillActions, useSkillLibrary } from '@/hooks/chat'
import { SettingsGroup } from '../settings-ui'

// Cộng đồng N7AI: lối vào /c/n7ai + skill được cài nhiều nhất
export function CommunityPanel() {
  const { data, isPending } = useSkillLibrary('')
  const { install } = useAiSkillActions()
  // Nổi bật = nhiều lượt cài nhất (không ưu tiên skill chính thức)
  const top = [...(data ?? [])].sort((a, b) => b.installCount - a.installCount).slice(0, 5)
  return (
    <>
      <div className="px-4 pb-2 sm:px-5">
        <Link href="/c/n7ai" className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-primary/10 to-brand-orange/10 p-4 hover:from-primary/15">
          <Users className="h-5 w-5 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Cộng đồng N7AI</span>
            <span className="block text-xs text-muted-foreground">Chia sẻ skill hay, mẹo học với N7AI, góp ý & báo lỗi</span>
          </span>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>
      <SettingsGroup label="Skill nổi bật">
        {isPending ? (
          <div className="space-y-2 py-1">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : top.length ? (
          <ul className="-mx-3 divide-y divide-border/60">
            {top.map((s) => (
              <SkillLibraryRow key={s.id} skill={s} installing={install.isPending} onInstall={() => install.mutate(s.id)} />
            ))}
          </ul>
        ) : (
          <p className="py-4 text-center text-xs text-muted-foreground">Chưa có skill công khai — hãy là người đầu tiên chia sẻ!</p>
        )}
      </SettingsGroup>
    </>
  )
}
