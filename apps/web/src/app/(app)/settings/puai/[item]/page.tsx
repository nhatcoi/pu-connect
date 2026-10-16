'use client'

import React from 'react'
import Link from 'next/link'
import { notFound, useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { CommunityPanel } from '@/components/settings/puai/community-panel'
import { ConnectorsPanel } from '@/components/settings/puai/connectors-panel'
import { MemoryPanel } from '@/components/settings/puai/memory-panel'
import { PrivacyPanel } from '@/components/settings/puai/privacy-panel'
import { SkillsPanel } from '@/components/settings/puai/skills-panel'
import { SupportPanel } from '@/components/settings/puai/support-panel'
import { TasksPanel } from '@/components/settings/puai/tasks-panel'
import { WebPanel } from '@/components/settings/puai/web-panel'
import { findPuaiItem } from '@/lib/puai-settings-registry'

const PANELS: Record<string, React.ComponentType> = {
  skills: SkillsPanel,
  tasks: TasksPanel,
  connectors: ConnectorsPanel,
  web: WebPanel,
  memory: MemoryPanel,
  community: CommunityPanel,
  support: SupportPanel,
  privacy: PrivacyPanel
}

// /settings/puai/[item]: 1 mục cài đặt PU AI
export default function PuaiSettingsItemPage() {
  const { item } = useParams<{ item: string }>()
  const meta = findPuaiItem(item)
  const Panel = PANELS[item]
  if (!meta || !Panel) notFound()

  return (
    <>
      <div className="flex items-start gap-2 px-2 pt-3 pb-2 sm:px-3">
        <Link
          href="/settings/puai"
          aria-label="Quay lại PU AI"
          className="mt-0.5 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 pt-1">
          <h1 className="text-lg font-bold leading-tight">{meta.label}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">{meta.description}</p>
        </div>
      </div>
      <Panel />
    </>
  )
}
