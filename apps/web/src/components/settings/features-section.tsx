'use client'

import React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { FeaturePreferenceKey } from '@pu/schemas'
import { useFeaturePreferences } from '@/hooks/use-settings'
import { FEATURE_PLUG_GROUPS } from '@/lib/settings-registry'
import { SettingsGroup, SwitchRow } from './settings-ui'

// Cờ ảnh hưởng dữ liệu server trả về ⇒ tải lại feed sau khi lưu
const REFETCH_FEED: FeaturePreferenceKey[] = ['featuredComment']

// Tính năng (Feature plugs): bật/tắt tiện ích theo nhóm, lưu ngay
export function FeaturesSection() {
  const { preferences, update } = useFeaturePreferences()
  const queryClient = useQueryClient()

  const toggle = async (key: FeaturePreferenceKey, value: boolean) => {
    const ok = await update({ [key]: value })
    if (ok && REFETCH_FEED.includes(key)) void queryClient.invalidateQueries({ queryKey: ['feed'] })
  }

  return (
    <>
      {FEATURE_PLUG_GROUPS.map((group) => (
        <SettingsGroup key={group.id} label={group.label}>
          {group.plugs.map((plug) => (
            <SwitchRow
              key={plug.key}
              id={`plug-${plug.key}`}
              label={plug.label}
              description={plug.description}
              checked={preferences[plug.key]}
              onCheckedChange={(v) => void toggle(plug.key, v)}
            />
          ))}
        </SettingsGroup>
      ))}
      <p className="px-4 pb-4 text-[11px] text-muted-foreground sm:px-5">
        Cài đặt áp dụng cho tài khoản của bạn trên mọi thiết bị.
      </p>
    </>
  )
}
