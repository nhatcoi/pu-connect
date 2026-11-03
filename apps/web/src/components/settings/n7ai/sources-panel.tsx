'use client'

import React from 'react'
import { Switch } from '@/components/ui/switch'
import { useAiConnectors, useConnectorPrefs } from '@/hooks/chat'
import { SettingsListSkeleton } from '@/components/skeletons/catalog-skeleton'
import { SettingsGroup } from '../settings-ui'

// Nguồn trong PU Connect: tool N7AI tự gọi khi cần (không phải kết nối tài khoản ngoài, không qua MCP).
// Công tắc bật = N7AI dùng nguồn này mặc định trong hội thoại riêng; tắt = N7AI bỏ qua nguồn đó trừ khi tự quyết cần dùng.
export function SourcesPanel() {
  const { data, isPending } = useAiConnectors()
  const { connectors: enabled, toggle } = useConnectorPrefs()
  if (isPending) return <SettingsListSkeleton count={6} />

  const list = (data ?? []).filter((c) => c.protocol === 'native' && c.id !== 'web' && c.id !== 'web_search')
  const internal = list.filter((c) => c.id !== 'semantic_scholar')
  const academic = list.filter((c) => c.id === 'semantic_scholar')

  const row = (c: (typeof list)[number]) => (
    <div key={c.id} className="flex items-center gap-3 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">{c.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{c.description}</span>
      </span>
      <Switch checked={enabled.includes(c.id)} onCheckedChange={() => toggle(c.id)} aria-label={`Dùng ${c.name} mặc định`} />
    </div>
  )

  return (
    <>
      <SettingsGroup label="Nguồn trong PU Connect" hint="Công tắc bật = N7AI tự gọi nguồn này khi cần, trong hội thoại riêng. Nhóm chat chỉ dùng Thư viện PU. Đây là công cụ N7AI tự chạy, không phải kết nối tài khoản ngoài.">
        {internal.map(row)}
      </SettingsGroup>
      {academic.length > 0 && (
        <SettingsGroup
          label="Nghiên cứu & Học thuật"
          hint="Tìm kiếm hàng triệu bài báo khoa học, abstract, trích dẫn và liên kết PDF từ Semantic Scholar & arXiv."
        >
          {academic.map(row)}
        </SettingsGroup>
      )}
    </>
  )
}
