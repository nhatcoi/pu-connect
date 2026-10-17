'use client'

import React from 'react'
import { notFound, useParams } from 'next/navigation'
import { SettingsHeader } from '@/components/settings/settings-ui'
import { AccountSection } from '@/components/settings/account-section'
import { PrivacySection } from '@/components/settings/privacy-section'
import { FeaturesSection } from '@/components/settings/features-section'
import { AppearanceSection } from '@/components/settings/appearance-section'
import { BlockedSection } from '@/components/settings/blocked-section'
import { SecuritySection } from '@/components/settings/security-section'
import { NotificationSettingsPanel } from '@/components/notifications/notification-settings-panel'
import { findSettingsPage, type SettingsPageId } from '@/lib/settings-registry'

function NotificationsSection() {
  return (
    <div className="px-4 pt-2 pb-4 sm:px-5">
      <NotificationSettingsPanel />
    </div>
  )
}

const SECTIONS: Record<SettingsPageId, React.ComponentType> = {
  account: AccountSection,
  security: SecuritySection,
  privacy: PrivacySection,
  features: FeaturesSection,
  notifications: NotificationsSection,
  appearance: AppearanceSection,
  blocked: BlockedSection
}

// /settings/[section]: 1 mục cài đặt
export default function SettingsSectionPage() {
  const { section } = useParams<{ section: string }>()
  const meta = findSettingsPage(section)
  if (!meta) notFound()
  const Section = SECTIONS[meta.id]

  return (
    <>
      <SettingsHeader title={meta.label} description={meta.description} />
      <Section />
    </>
  )
}
