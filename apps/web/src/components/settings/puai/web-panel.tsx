'use client'

import React from 'react'
import { Loader2 } from 'lucide-react'
import { useAiConnectors, useConnectorPrefs } from '@/hooks/chat'
import { SettingRow, SettingsGroup } from '../settings-ui'
import { Switch } from '@/components/ui/switch'

// Duyệt web: đọc link trong câu hỏi + tìm kiếm Internet (không chạy trình duyệt headless trên máy chủ)
export function WebPanel() {
  const { data, isPending } = useAiConnectors()
  const { connectors, toggle } = useConnectorPrefs()
  if (isPending) return <Loader2 className="mx-auto my-6 h-4 w-4 animate-spin text-muted-foreground" />
  const search = data?.find((c) => c.id === 'web_search')

  return (
    <>
      <SettingsGroup
        label="Trình duyệt của PU AI"
        hint="PU AI chỉ tải trang công khai (http/https), chặn địa chỉ nội bộ, tối đa 2 link mỗi câu hỏi, 1 MB mỗi trang. Không đăng nhập, không chạy JavaScript."
      >
        <SettingRow label="Đọc trang web" description="Dán link vào câu hỏi, PU AI đọc nội dung trang để trả lời">
          <Switch checked={connectors.includes('web')} onCheckedChange={() => toggle('web')} aria-label="Đọc trang web" />
        </SettingRow>
        <SettingRow
          label="Tìm kiếm web"
          description={
            search?.available ? 'Tìm trên Internet khi thư viện PU chưa đủ (dùng cùng Research để có nhiều nguồn)' : 'Máy chủ chưa cấu hình dịch vụ tìm kiếm'
          }
        >
          <Switch
            disabled={!search?.available}
            checked={!!search?.available && connectors.includes('web_search')}
            onCheckedChange={() => toggle('web_search')}
            aria-label="Tìm kiếm web"
          />
        </SettingRow>
      </SettingsGroup>
      <p className="px-4 pb-4 text-[11px] leading-relaxed text-muted-foreground sm:px-5">
        Trình duyệt đám mây thật (tự bấm, điền form trên trang) chưa hỗ trợ vì cần máy chủ riêng để chạy an toàn.
      </p>
    </>
  )
}
