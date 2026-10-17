'use client'

import React, { useState } from 'react'
import { Download, Loader2, Trash2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { chatApi, refreshConversationLists, useAiSettings } from '@/hooks/chat'
import { errorMessage } from '@/lib/api-client'
import { SettingRow, SettingsGroup, SwitchRow } from '../settings-ui'

const RETENTION: { value: 30 | 365 | null; label: string }[] = [
  { value: 30, label: '30 ngày' },
  { value: 365, label: '1 năm' },
  { value: null, label: 'Không tự xóa' }
]

// Quyền riêng tư N7AI: bộ nhớ, thời gian lưu lịch sử, xuất / xóa toàn bộ dữ liệu
export function PrivacyPanel() {
  const qc = useQueryClient()
  const { settings, update } = useAiSettings()
  const [exporting, setExporting] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Tải về file JSON dữ liệu của chính mình
  const exportData = async () => {
    setExporting(true)
    try {
      const data = await chatApi.exportAiData()
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const a = Object.assign(document.createElement('a'), { href: url, download: `n7ai-data-${new Date().toISOString().slice(0, 10)}.json` })
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(errorMessage(err, 'Không xuất được dữ liệu'))
    } finally {
      setExporting(false)
    }
  }

  const deleteAll = async () => {
    setDeleting(true)
    try {
      const { threads } = await chatApi.deleteAiData()
      toast.success(`Đã xóa dữ liệu N7AI (${threads} hội thoại)`)
      setConfirm(false)
      void qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('ai-') })
      refreshConversationLists(qc)
    } catch (err) {
      toast.error(errorMessage(err, 'Không xóa được'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <SettingsGroup>
        <SwitchRow
          id="ai-memory-privacy"
          label="Bộ nhớ N7AI"
          description="N7AI ghi nhớ điều bền về bạn để cá nhân hóa (quản lý ở mục Bộ nhớ)"
          checked={settings?.memoryEnabled ?? true}
          onCheckedChange={(memoryEnabled) => update.mutate({ memoryEnabled })}
        />
        <SettingRow label="Tự xóa lịch sử N7AI" description="Hội thoại không hoạt động lâu hơn mốc này sẽ bị xóa (kèm tệp đính kèm)">
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={String(settings?.retentionDays ?? 'never')}
            onChange={(e) => update.mutate({ retentionDays: e.target.value === 'never' ? null : (Number(e.target.value) as 30 | 365) })}
            aria-label="Thời gian lưu lịch sử"
          >
            {RETENTION.map((r) => (
              <option key={r.label} value={String(r.value ?? 'never')}>
                {r.label}
              </option>
            ))}
          </select>
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup
        label="Dữ liệu của bạn"
        hint="Nội dung câu hỏi được gửi tới nhà cung cấp mô hình AI để tạo câu trả lời; PU Connector không dùng để huấn luyện mô hình."
      >
        <SettingRow label="Tải dữ liệu N7AI" description="Hội thoại, bộ nhớ, skill, tác vụ (JSON)">
          <Button size="sm" variant="outline" className="h-8 rounded-full gap-1 text-xs" disabled={exporting} onClick={exportData}>
            {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} Tải về
          </Button>
        </SettingRow>
        <SettingRow label="Xóa toàn bộ dữ liệu N7AI" description="Hội thoại, bộ nhớ, skill, tác vụ, kết nối Google — không thể hoàn tác">
          <Button size="sm" variant="outline" className="h-8 rounded-full gap-1 text-xs text-destructive" onClick={() => setConfirm(true)}>
            <Trash2 className="h-3 w-3" /> Xóa
          </Button>
        </SettingRow>
      </SettingsGroup>

      <Dialog open={confirm} onOpenChange={(v) => !deleting && setConfirm(v)}>
        <DialogContent className="max-w-sm p-5 gap-4">
          <DialogHeader>
            <DialogTitle className="text-base">Xóa toàn bộ dữ liệu N7AI?</DialogTitle>
            <DialogDescription className="text-xs">
              Mọi hội thoại N7AI, bộ nhớ, skill, tác vụ tự động và kết nối Google sẽ bị xóa vĩnh viễn. Tin nhắn với bạn bè không bị ảnh hưởng.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => setConfirm(false)} disabled={deleting}>
              Hủy
            </Button>
            <Button variant="destructive" size="sm" className="rounded-full" onClick={deleteAll} disabled={deleting}>
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Xóa vĩnh viễn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
