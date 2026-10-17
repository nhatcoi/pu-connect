'use client'

import React from 'react'
import { notFound, useParams } from 'next/navigation'
import { N7AiPageHeader } from '@/components/n7ai/n7ai-page-header'
import { CommunityPanel } from '@/components/settings/n7ai/community-panel'
import { ConnectorsPanel } from '@/components/settings/n7ai/connectors-panel'
import { MemoryPanel } from '@/components/settings/n7ai/memory-panel'
import { PrivacyPanel } from '@/components/settings/n7ai/privacy-panel'
import { SkillsPanel } from '@/components/settings/n7ai/skills-panel'
import { SupportPanel } from '@/components/settings/n7ai/support-panel'
import { TasksPanel } from '@/components/settings/n7ai/tasks-panel'
import { WebPanel } from '@/components/settings/n7ai/web-panel'
import { n7aiSettingsHref } from '@/lib/n7ai-routes'
import { findN7AiItem } from '@/lib/n7ai-settings-registry'

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

// /n7ai/settings/[item]: 1 mục cài đặt N7AI
export default function N7AiSettingsItemPage() {
  const { item } = useParams<{ item: string }>()
  const meta = findN7AiItem(item)
  const Panel = PANELS[item]
  if (!meta || !Panel) notFound()

  return (
    <>
      <N7AiPageHeader title={meta.label} description={meta.description} backHref={n7aiSettingsHref()} />
      <div className="mx-2 rounded-xl bg-card sm:mx-0">
        <Panel />
      </div>
    </>
  )
}
