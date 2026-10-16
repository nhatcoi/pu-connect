'use client'

import React from 'react'
import { useParams, usePathname } from 'next/navigation'
import { PageAside } from '@/components/layout/page-aside'
import { SettingsNav } from '@/components/settings/settings-ui'
import { findSettingsSection } from '@/lib/settings-registry'

// Khung Cài đặt: cột giữa = nội dung; desktop (lg+) có menu mục ở cột phải khi đang ở trang con
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ section?: string }>()
  const pathname = usePathname()
  // /settings/puai/[item] là trang con của mục PU AI
  const active = pathname.startsWith('/settings/puai') ? 'puai' : params.section ? findSettingsSection(params.section)?.id : undefined

  return (
    <div className="pt-3">
      <div className="mx-2 overflow-hidden rounded-xl bg-card sm:mx-0">{children}</div>
      {active && (
        <PageAside>
          <div className="rounded-xl bg-card">
            <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cài đặt</p>
            <SettingsNav active={active} compact />
          </div>
        </PageAside>
      )}
    </div>
  )
}
