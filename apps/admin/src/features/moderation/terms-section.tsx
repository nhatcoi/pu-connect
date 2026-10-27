import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Plus, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import type { AdminModerationTerm } from '@pu/schemas'
import { adminApi } from '@/lib/api'
import { useDebounced } from '@/hooks/use-debounced'
import { Badge, Button, Card, EmptyState, Input, LoadingRows, Select, Textarea } from '@/components/ui'

const KEY = ['admin', 'moderation-terms']
type Severity = AdminModerationTerm['severity']
const SEVERITY: Record<Severity, { label: string; tone: 'danger' | 'warning' | 'neutral'; hint: string }> = {
  heavy: { label: 'Nặng', tone: 'danger', hint: 'Chặn đăng' },
  medium: { label: 'Vừa', tone: 'warning', hint: 'Gắn cờ khi nhắm vào người' },
  light: { label: 'Nhẹ', tone: 'neutral', hint: 'Gắn cờ nhẹ' }
}

// Từ cấm admin tự thêm, bổ sung cho từ điển có sẵn trong code của kiểm duyệt tự động
export function TermsSection({ canWrite }: { canWrite: boolean }) {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 300)
  const [term, setTerm] = useState('')
  const [severity, setSeverity] = useState<Severity>('medium')
  const [bulk, setBulk] = useState('')
  const list = useQuery({ queryKey: [...KEY, dq], queryFn: () => adminApi.get<AdminModerationTerm[]>(`/admin/moderation-terms?q=${encodeURIComponent(dq)}`) })

  const refresh = () => void qc.invalidateQueries({ queryKey: KEY })
  const onError = (err: Error) => toast.error(err.message)
  const add = useMutation({
    mutationFn: () => adminApi.post('/admin/moderation-terms', { term, severity }),
    onSuccess: () => (setTerm(''), refresh()),
    onError
  })
  const importAll = useMutation({
    mutationFn: () => adminApi.post<{ added: number; skipped: number }>('/admin/moderation-terms/import', { terms: bulk.split(/[\n,]+/).map((t) => t.trim()).filter((t) => t.length >= 2), severity }),
    onSuccess: (r) => {
      toast.success(`Đã thêm ${r.added} từ${r.skipped ? `, bỏ qua ${r.skipped} từ trùng` : ''}`)
      setBulk('')
      refresh()
    },
    onError
  })
  const change = useMutation({
    mutationFn: (t: AdminModerationTerm & { next: Severity }) => adminApi.put(`/admin/moderation-terms/${t.id}`, { term: t.term, severity: t.next, note: t.note }),
    onSuccess: refresh,
    onError
  })
  const remove = useMutation({ mutationFn: (id: string) => adminApi.delete(`/admin/moderation-terms/${id}`), onSuccess: refresh, onError })

  const rows = list.data ?? []

  return (
    <div className="space-y-4">
      {canWrite && (
        <Card className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground">
            Từ thêm ở đây được gộp vào từ điển của kiểm duyệt tự động (cần bật <code>MODERATION_MODE</code>). <strong>Nặng</strong> chặn đăng, <strong>vừa</strong> và <strong>nhẹ</strong> chỉ gắn cờ.
          </p>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (term.trim().length >= 2) add.mutate()
            }}
          >
            <Input className="min-w-48 flex-1" value={term} maxLength={80} onChange={(e) => setTerm(e.target.value)} placeholder="Thêm một từ hoặc cụm từ" />
            <Select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)} className="w-40">
              {(Object.keys(SEVERITY) as Severity[]).map((s) => (
                <option key={s} value={s}>
                  {SEVERITY[s].label} · {SEVERITY[s].hint}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="primary" loading={add.isPending} disabled={term.trim().length < 2}>
              <Plus /> Thêm
            </Button>
          </form>
          <details>
            <summary className="cursor-pointer text-sm font-medium">Dán nhiều từ</summary>
            <div className="mt-2 space-y-2">
              <Textarea rows={4} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="Mỗi từ một dòng hoặc cách nhau bằng dấu phẩy (dùng mức độ đang chọn ở trên)" />
              <Button loading={importAll.isPending} disabled={!bulk.trim()} onClick={() => importAll.mutate()}>
                <Upload /> Thêm tất cả
              </Button>
            </div>
          </details>
        </Card>
      )}

      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm trong danh sách" />
      {list.isPending ? (
        <LoadingRows rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Ban} title={dq ? 'Không có từ phù hợp' : 'Chưa có từ cấm nào do admin thêm'} />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">{t.term}</span>
              {t.createdBy && <span className="hidden text-xs text-muted-foreground sm:inline">@{t.createdBy}</span>}
              {canWrite ? (
                <Select value={t.severity} onChange={(e) => change.mutate({ ...t, next: e.target.value as Severity })} className="w-24">
                  {(Object.keys(SEVERITY) as Severity[]).map((s) => (
                    <option key={s} value={s}>
                      {SEVERITY[s].label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Badge tone={SEVERITY[t.severity].tone}>{SEVERITY[t.severity].label}</Badge>
              )}
              {canWrite && (
                <Button variant="danger-soft" size="icon-sm" title="Xóa từ" onClick={() => remove.mutate(t.id)}>
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
