'use client'

import React, { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import type { AiConnectorInfo } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { chatApi, useAiConnectors, useConnectorPrefs, useDisconnectConnector } from '@/hooks/chat'
import { queryKeys } from '@/lib/query-keys'
import { formatRelativeTime } from '@/lib/utils'
import { ConnectorIcon } from '@/components/n7ai/connector-icon'
import { SettingsListSkeleton } from '@/components/skeletons/catalog-skeleton'
import { SettingsGroup } from '../settings-ui'

const CONNECTOR_NAMES: Record<string, string> = { 'google-drive': 'Google Drive', 'google-calendar': 'Google Calendar', 'google-gmail': 'Gmail' }

// Quay về từ màn đồng ý Google (?connector=&result=) ⇒ báo kết quả, làm mới danh sách, xóa tham số khỏi URL
function useConnectResultToast() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const qc = useQueryClient()
  const connector = params.get('connector')
  const result = params.get('result')
  useEffect(() => {
    if (!connector || !result) return
    const name = CONNECTOR_NAMES[connector] ?? 'Google'
    if (result === 'connected') toast.success(`Đã kết nối ${name} — bật trong + › Connectors khi hỏi N7AI`)
    else toast.error(`Không kết nối được ${name}. Thử lại nhé!`)
    void qc.invalidateQueries({ queryKey: queryKeys.aiConnectors })
    router.replace(pathname)
  }, [connector, result, qc, router, pathname])
}

// Trình kết nối: nguồn N7AI đọc khi trả lời; công tắc = bật mặc định (đồng bộ mọi thiết bị)
export function ConnectorsPanel() {
  useConnectResultToast()
  const { data, isPending } = useAiConnectors()
  const { connectors: enabled, toggle } = useConnectorPrefs()
  const disconnect = useDisconnectConnector()
  if (isPending) return <SettingsListSkeleton count={6} />
  const list = (data ?? []).filter((c) => c.id !== 'web' && c.id !== 'web_search') // ở mục Duyệt web
  const internal = list.filter((c) => !c.requiresAuth)
  const external = list.filter((c) => c.requiresAuth)

  const row = (c: AiConnectorInfo) => (
    <div key={c.id} className="py-3">
      <div className="flex items-center gap-3">
        <ConnectorIcon id={c.id} className="h-6 w-6" />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium">{c.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{c.account ?? c.description}</span>
          {c.lastUsedAt && !c.lastError && <span className="block text-[11px] text-muted-foreground">Dùng {formatRelativeTime(c.lastUsedAt)}</span>}
        </span>
        {c.requiresAuth && !c.connected ? (
          <Button
            size="sm"
            variant="outline"
            className="h-9 rounded-full gap-1 text-xs"
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
            {c.requiresAuth && c.lastError && (
              <Button
                size="sm"
                variant="outline"
                className="h-9 rounded-full text-xs"
                onClick={() => window.location.assign(chatApi.connectorConnectUrl(c.id))}
              >
                Kết nối lại
              </Button>
            )}
            {c.requiresAuth && (
              <Button
                size="sm"
                variant="ghost"
                className="h-9 rounded-full text-xs text-destructive"
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
      {c.lastError && (
        <p className="mt-2 flex items-start gap-1 text-[11px] text-destructive">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>Lỗi gần nhất: {c.lastError}</span>
        </p>
      )}
    </div>
  )

  return (
    <>
      <SettingsGroup label="Nguồn trong PU Connector" hint="Công tắc bật = N7AI dùng nguồn này mặc định trong hội thoại riêng. Nhóm chat chỉ dùng Thư viện PU.">
        {internal.map(row)}
      </SettingsGroup>
      <SettingsGroup label="Tài khoản Google" hint="Chỉ đọc. Token được mã hóa; ngắt kết nối sẽ thu hồi quyền ở phía Google.">
        {external.map(row)}
      </SettingsGroup>
    </>
  )
}
