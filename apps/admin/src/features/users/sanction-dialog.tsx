import React, { useEffect, useState } from 'react'
import { Lightbulb } from 'lucide-react'
import { SANCTION_DURATIONS, type AdminUserRow, type SanctionKind } from '@pu/schemas'
import { cn } from '@/lib/api'
import { Button, Dialog, Field, Select, Textarea } from '@/components/ui'
import { useUserDetail, type BulkVars } from './use-users'

export const SANCTION_LABEL: Record<SanctionKind, string> = {
  warning: 'Cảnh cáo',
  restrict: 'Hạn chế',
  suspend: 'Khóa'
}

const KIND_HINT: Record<SanctionKind, string> = {
  warning: 'Gửi thông báo cảnh cáo, tính 1 lần vi phạm. Không ảnh hưởng quyền dùng.',
  restrict: 'Chỉ xem: không đăng bài, bình luận, nhắn tin hay tải tài liệu.',
  suspend: 'Không đăng nhập được, bị đăng xuất khỏi mọi thiết bị ngay.'
}

export const durationLabel = (days: number | null) => (days ? `${days} ngày` : 'Vĩnh viễn')

// Xử phạt 1 hoặc nhiều người — 1 người thì đề xuất bậc theo lịch sử vi phạm
export function SanctionDialog({
  users,
  presetKind,
  onClose,
  onSubmit,
  loading
}: {
  users: AdminUserRow[]
  // Mở từ nút "Khóa" ⇒ chọn sẵn loại (vẫn đổi được)
  presetKind?: SanctionKind
  onClose: () => void
  onSubmit: (v: Omit<BulkVars, 'ids'>) => void
  loading: boolean
}) {
  const single = users.length === 1 ? users[0] : null
  const detail = useUserDetail(single?.id ?? null)
  const rec = detail.data?.recommendation

  const [kind, setKind] = useState<SanctionKind>('warning')
  const [days, setDays] = useState<number | null>(7)
  const [reason, setReason] = useState('')

  // Mở lại ⇒ reset; có đề xuất ⇒ chọn sẵn
  useEffect(() => {
    if (!users.length) return
    setReason('')
    const kind = presetKind ?? rec?.kind ?? 'warning'
    setKind(kind)
    // Thời hạn: theo đề xuất nếu cùng loại, ngược lại 7 ngày
    setDays(rec && rec.kind === kind ? rec.durationDays : 7)
  }, [users, rec, presetKind])

  const action = { warning: 'warn', restrict: 'restrict', suspend: 'suspend' } as const

  return (
    <Dialog
      open={users.length > 0}
      onClose={onClose}
      title={single ? `Xử phạt @${single.username}` : `Xử phạt ${users.length} tài khoản`}
      description={users.length > 1 ? 'Quản trị viên trong danh sách sẽ được bỏ qua.' : undefined}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button
            variant={kind === 'warning' ? 'primary' : 'danger'}
            loading={loading}
            disabled={reason.trim().length < 3}
            onClick={() => onSubmit({ action: action[kind], reason: reason.trim(), durationDays: kind === 'warning' ? null : days })}
          >
            {SANCTION_LABEL[kind]}
            {kind !== 'warning' && ` · ${durationLabel(days)}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {single && rec && (
          <div className="flex gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-foreground">
              {rec.strikes === 0 ? 'Chưa vi phạm lần nào trong 180 ngày.' : `Đã vi phạm ${rec.strikes} lần trong 180 ngày.`} Đề xuất:{' '}
              <b>
                {SANCTION_LABEL[rec.kind]}
                {rec.kind !== 'warning' && ` ${durationLabel(rec.durationDays).toLowerCase()}`}
              </b>
              .
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {(['warning', 'restrict', 'suspend'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                'rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer',
                kind === k
                  ? k === 'warning'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-red-500/60 bg-red-500/5 ring-1 ring-red-500/60'
                  : 'border-border hover:bg-accent'
              )}
            >
              <span className="block text-sm font-semibold text-foreground">{SANCTION_LABEL[k]}</span>
              <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{k === 'warning' ? 'Nhắc nhở' : k === 'restrict' ? 'Chỉ xem' : 'Chặn đăng nhập'}</span>
            </button>
          ))}
        </div>
        <p className="-mt-1 text-xs text-muted-foreground">{KIND_HINT[kind]}</p>

        {kind !== 'warning' && (
          <Field label="Thời hạn">
            <Select value={days ?? ''} onChange={(e) => setDays(e.target.value ? Number(e.target.value) : null)}>
              {SANCTION_DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} ngày
                </option>
              ))}
              <option value="">Vĩnh viễn (đến khi gỡ)</option>
            </Select>
          </Field>
        )}

        <Field label="Lý do" hint="Người dùng sẽ thấy">
          <Textarea rows={3} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="VD: Đăng lại đề thi giữa kỳ sau khi đã bị nhắc" />
        </Field>
      </div>
    </Dialog>
  )
}
