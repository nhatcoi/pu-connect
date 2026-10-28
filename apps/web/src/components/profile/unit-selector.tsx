'use client'

import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { UnitChoiceInput } from '@pu/schemas'
import { SuggestPickerDialog } from '@/components/common/suggest-picker'
import { useUnits } from '@/hooks/use-units'
import { cn } from '@/lib/utils'

// '' = chưa chọn · OTHER = "Khác" (tên tự nhập, chờ admin duyệt) · còn lại là id trong danh mục
export const OTHER = 'other'

type RequestStatus = 'pending' | 'rejected' | null

export interface UnitChoice {
  universityId: string
  universityOther: string
  universityStatus: RequestStatus
  interestFieldId: string
  interestFieldOther: string
  interestFieldStatus: RequestStatus
}

interface ProfileUnits {
  universityId?: string | null
  universityRequest?: string | null
  universityRequestStatus?: RequestStatus
  interestFieldId?: string | null
  interestFieldRequest?: string | null
  interestFieldRequestStatus?: RequestStatus
}

// Từ hồ sơ: đã duyệt ⇒ id; đang chờ duyệt / bị từ chối ⇒ "Khác" + tên đã gửi
export function initialUnitChoice(p: ProfileUnits): UnitChoice {
  return {
    universityId: p.universityId ?? (p.universityRequest ? OTHER : ''),
    universityOther: p.universityRequest ?? '',
    universityStatus: p.universityRequestStatus ?? null,
    interestFieldId: p.interestFieldId ?? (p.interestFieldRequest ? OTHER : ''),
    interestFieldOther: p.interestFieldRequest ?? '',
    interestFieldStatus: p.interestFieldRequestStatus ?? null
  }
}

// Sang dữ liệu gửi API: "Khác" mà không nhập tên ⇒ coi như bỏ chọn
export function unitChoicePayload(c: UnitChoice): UnitChoiceInput {
  const pick = (id: string, other: string) => (id === OTHER ? { id: null, other: other.trim() || null } : { id: id || null, other: null })
  const uni = pick(c.universityId, c.universityOther)
  const field = pick(c.interestFieldId, c.interestFieldOther)
  return { universityId: uni.id, universityOther: uni.other, interestFieldId: field.id, interestFieldOther: field.other }
}

interface UnitSelectorProps {
  value: UnitChoice
  onChange: (value: UnitChoice) => void
}

const FIELD = 'group w-full rounded-xl border border-input bg-background/50 px-3 pt-2 pb-1.5 text-left transition-all hover:border-primary/60 focus-visible:border-primary focus-visible:outline-none cursor-pointer'
const LABEL = 'block text-[11px] font-medium text-muted-foreground'

interface UnitPickerProps {
  label: string
  placeholder: string
  noun: string
  title: string
  options: { id: string; name: string }[]
  id: string
  other: string
  status: RequestStatus
  onChange: (id: string, other: string) => void
}

// Ô chọn mở hộp A–Z có ô tìm; "Khác" ⇒ nhập tên đề xuất (gửi khi bấm Lưu hồ sơ)
function UnitPicker({ label, placeholder, noun, title, options, id, other, status, onChange }: UnitPickerProps) {
  const [open, setOpen] = useState(false)
  const isOther = id === OTHER
  const shown = isOther ? 'Khác' : (options.find((o) => o.id === id)?.name ?? placeholder)
  const note = isOther ? (other.trim() ? `“${other.trim()}” — ${status === 'rejected' ? 'chưa được duyệt' : 'chờ duyệt'}` : '') : ''

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={FIELD} aria-label={label}>
        <span className={LABEL}>{label}</span>
        <span className="flex items-center justify-between gap-2">
          <span className={cn('truncate text-sm', !id && 'text-muted-foreground')}>{shown}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </span>
        {note && <span className={cn('block truncate text-[11px]', status === 'rejected' ? 'text-destructive' : 'text-muted-foreground')}>{note}</span>}
      </button>
      <SuggestPickerDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        options={options}
        value={id}
        clearLabel={id ? 'Bỏ chọn' : undefined}
        onSelect={(next) => onChange(next ?? '', '')}
        suggest={{
          noun,
          fields: [{ key: 'name', label: `Tên ${noun}`, required: true, maxLength: 200, placeholder: `Nhập tên ${noun}` }],
          successMessage: 'Đã ghi nhận. Bấm Lưu để gửi cho quản trị viên duyệt',
          onSubmit: (v) => onChange(OTHER, v.name.trim())
        }}
      />
    </>
  )
}

// Chỉ hai thông tin: trường đại học và lĩnh vực quan tâm. "Khác" ⇒ nhập tên, admin duyệt rồi hồ sơ mới cập nhật.
export function UnitSelector({ value, onChange }: UnitSelectorProps) {
  const { data } = useUnits()
  const pending = value.universityId === OTHER || value.interestFieldId === OTHER

  return (
    <div className="space-y-3.5">
      <UnitPicker
        label="Trường đại học"
        placeholder="Chọn trường"
        noun="trường"
        title="Chọn trường đại học"
        options={data?.universities ?? []}
        id={value.universityId}
        other={value.universityOther}
        status={value.universityStatus}
        onChange={(universityId, universityOther) => onChange({ ...value, universityId, universityOther, universityStatus: null })}
      />
      <UnitPicker
        label="Lĩnh vực quan tâm"
        placeholder="Chọn lĩnh vực"
        noun="lĩnh vực"
        title="Chọn lĩnh vực quan tâm"
        options={data?.fields ?? []}
        id={value.interestFieldId}
        other={value.interestFieldOther}
        status={value.interestFieldStatus}
        onChange={(interestFieldId, interestFieldOther) => onChange({ ...value, interestFieldId, interestFieldOther, interestFieldStatus: null })}
      />
      {pending && (
        <p className="text-[11px] text-muted-foreground px-1">
          Mục &quot;Khác&quot; chờ quản trị viên duyệt: được duyệt thì hồ sơ tự cập nhật, bị từ chối thì vẫn hiển thị là &quot;Khác&quot; cho tới khi bạn chọn lại.
        </p>
      )}
    </div>
  )
}
