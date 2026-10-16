'use client'

import React from 'react'
import { notFound, useParams } from 'next/navigation'
import { PuaiPageHeader } from '@/components/puai/puai-page-header'
import { CommunityPanel } from '@/components/settings/puai/community-panel'
import { ConnectorsPanel } from '@/components/settings/puai/connectors-panel'
import { MemoryPanel } from '@/components/settings/puai/memory-panel'
import { PrivacyPanel } from '@/components/settings/puai/privacy-panel'
import { SkillsPanel } from '@/components/settings/puai/skills-panel'
import { SupportPanel } from '@/components/settings/puai/support-panel'
import { TasksPanel } from '@/components/settings/puai/tasks-panel'
import { WebPanel } from '@/components/settings/puai/web-panel'
import { puaiSettingsHref } from '@/lib/puai-routes'
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

// /puai/settings/[item]: 1 mục cài đặt PU AI
export default function PuaiSettingsItemPage() {
  const { item } = useParams<{ item: string }>()
  const meta = findPuaiItem(item)
  const Panel = PANELS[item]
  if (!meta || !Panel) notFound()

  return (
    <>
      <PuaiPageHeader title={meta.label} description={meta.description} backHref={puaiSettingsHref()} />
      <div className="mx-2 rounded-xl bg-card sm:mx-0">
        <Panel />
      </div>
    </>
  )
}
