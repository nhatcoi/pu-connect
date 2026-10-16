'use client'

import React from 'react'
import { AlertTriangle, ExternalLink, Loader2 } from 'lucide-react'
import type { AiConnectorInfo } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { chatApi, useAiConnectors, useConnectorPrefs, useDisconnectConnector } from '@/hooks/chat'
import { formatRelativeTime } from '@/lib/utils'
import { SettingsGroup } from '../settings-ui'

// Trình kết nối: nguồn PU AI đọc khi trả lời; công tắc = bật mặc định (đồng bộ mọi thiết bị)
export function ConnectorsPanel() {
  const { data, isPending } = useAiConnectors()
  const { connectors: enabled, toggle } = useConnectorPrefs()
  const disconnect = useDisconnectConnector()
  if (isPending) return <Loader2 className="mx-auto my-6 h-4 w-4 animate-spin text-muted-foreground" />
  const list = (data ?? []).filter((c) => c.id !== 'web' && c.id !== 'web_search') // ở mục Duyệt web
  const internal = list.filter((c) => !c.requiresAuth)
  const external = list.filter((c) => c.requiresAuth)

  const row = (c: AiConnectorInfo) => (
    <div key={c.id} className="flex items-center gap-3 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">{c.name}</span>
        <span className="block text-xs text-muted-foreground">{c.account ?? c.description}</span>
        {c.lastError && (
          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-destructive">
            <AlertTriangle className="h-3 w-3" /> Lỗi gần nhất: {c.lastError}
          </span>
        )}
        {c.lastUsedAt && !c.lastError && <span className="block text-[11px] text-muted-foreground">Dùng {formatRelativeTime(c.lastUsedAt)}</span>}
      </span>
      {c.requiresAuth && !c.connected ? (
        <Button
          size="sm"
          variant="outline"
          className="h-8 rounded-full gap-1 text-xs"
          disabled={!c.available}
          onClick={() => window.location.assign(chatApi.connectorConnectUrl(c.id))}
        >
          {c.available ? (
            <>
              Kết nối <ExternalLink className="h-3 w-3" />
            </>
          ) : (
            'Chưa cấu hình'
          )}
        </Button>
      ) : (
        <>
          {c.requiresAuth && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 rounded-full text-xs text-destructive"
              disabled={disconnect.isPending}
              onClick={() => disconnect.mutate(c)}
            >
              Ngắt
            </Button>
          )}
          <Switch checked={enabled.includes(c.id)} onCheckedChange={() => toggle(c.id)} aria-label={`Dùng ${c.name} mặc định`} />
        </>
      )}
    </div>
  )

  return (
    <>
      <SettingsGroup
        label="Nguồn trong PU Connector"
        hint="Công tắc bật = PU AI dùng nguồn này mặc định trong hội thoại riêng. Nhóm chat chỉ dùng Thư viện PU."
      >
        {internal.map(row)}
      </SettingsGroup>
      <SettingsGroup label="Tài khoản Google" hint="Chỉ đọc. Token được mã hóa; ngắt kết nối sẽ thu hồi quyền ở phía Google.">
        {external.map(row)}
      </SettingsGroup>
    </>
  )
}
