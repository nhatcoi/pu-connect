'use client'

import React, { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import type { AiConnectorInfo } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import { chatApi, useAiConnectors, useDisconnectConnector } from '@/hooks/chat'
import { queryKeys } from '@/lib/query-keys'
import { formatRelativeTime } from '@/lib/utils'
import { PuConnectorDialog } from '@/components/n7ai/pu-connector-dialog'
import { ConnectorIcon } from '@/components/n7ai/connector-icon'
import { SettingsListSkeleton } from '@/components/skeletons/catalog-skeleton'
import { SettingsGroup } from '../settings-ui'

const CONNECTOR_NAMES: Record<string, string> = {
  'pu-connector': 'PU Connect',
  'semantic-scholar': 'Semantic Scholar',
  'google-drive': 'Google Drive',
  'google-calendar': 'Google Calendar',
  'google-gmail': 'Gmail',
  'google-forms': 'Google Forms',
  'google-sheets': 'Google Sheets',
  'google-tasks': 'Google Tasks'
}

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
    if (result === 'connected') toast.success(`Đã kết nối ${name}`)
    else toast.error(`Không kết nối được ${name}. Thử lại nhé!`)
    void qc.invalidateQueries({ queryKey: queryKeys.aiConnectors })
    void qc.invalidateQueries({ queryKey: queryKeys.aiSettings })
    router.replace(pathname)
  }, [connector, result, qc, router, pathname])
}

// Trình kết nối: tài khoản ngoài N7AI nối qua MCP thật (PU Connect, Google). Nguồn tool nội bộ (thư viện, tài liệu...) xem mục Nguồn.
export function ConnectorsPanel() {
  useConnectResultToast()
  const [puOpen, setPuOpen] = useState(false)
  const { data, isPending } = useAiConnectors()
  const disconnect = useDisconnectConnector()
  if (isPending) return <SettingsListSkeleton count={4} />
  const list = (data ?? []).filter((c) => c.protocol === 'mcp')
  const external = list.filter((c) => c.id.startsWith('google_'))
  const connect = (id: AiConnectorInfo['id']) => (id === 'pu_connector' ? setPuOpen(true) : window.location.assign(chatApi.connectorConnectUrl(id)))

  const row = (c: AiConnectorInfo) => (
    <div key={c.id} className="py-3">
      <div className="flex items-center gap-3">
        <ConnectorIcon id={c.id} className="h-6 w-6" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="text-[13px] font-medium">{c.name}</span>
            <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">MCP</span>
          </span>
          <span className="block truncate text-xs text-muted-foreground">{c.account ?? c.description}</span>
          {c.lastUsedAt && !c.lastError && <span className="block text-[11px] text-muted-foreground">Dùng {formatRelativeTime(c.lastUsedAt)}</span>}
        </span>
        {!c.connected ? (
          <Button size="sm" variant="outline" className="h-9 rounded-full gap-1 text-xs" disabled={!c.available} onClick={() => connect(c.id)}>
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
            {c.lastError && (
              <Button size="sm" variant="outline" className="h-9 rounded-full text-xs" onClick={() => connect(c.id)}>
                Kết nối lại
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-9 rounded-full text-xs text-destructive"
              disabled={disconnect.isPending}
              onClick={() => disconnect.mutate(c)}
            >
              Ngắt
            </Button>
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
      <SettingsGroup label="Tài khoản trường" hint="Kết nối qua Model Context Protocol (MCP). Hồ sơ, lịch học, điểm và deadline từ tài khoản trường.">
        {list.filter((c) => c.id === 'pu_connector').map(row)}
      </SettingsGroup>
      <PuConnectorDialog open={puOpen} onOpenChange={setPuOpen} />
      <SettingsGroup
        label="Tài khoản Google"
        hint="Kết nối qua MCP: Google Drive, Lịch, Gmail và Biểu mẫu. Token được mã hóa; ngắt kết nối sẽ thu hồi quyền ở phía Google."
      >
        {external.map(row)}
      </SettingsGroup>
    </>
  )
}
