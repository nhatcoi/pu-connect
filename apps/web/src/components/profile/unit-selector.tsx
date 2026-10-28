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

// Số lĩnh vực quan tâm tối đa (khớp MAX_INTEREST_FIELDS ở API: unit-sql.ts); "Khác" chờ duyệt cũng chiếm một chỗ
export const MAX_INTEREST_FIELDS = 3

export interface UnitChoice {
  universityId: string
  universityOther: string
  universityStatus: RequestStatus
  interestFieldIds: string[]
  interestFieldOther: string
  interestFieldStatus: RequestStatus
}

interface ProfileUnits {
  universityId?: string | null
  universityRequest?: string | null
  universityRequestStatus?: RequestStatus
  interestFieldId?: string | null
  interestFieldIds?: string[]
  interestFieldRequest?: string | null
  interestFieldRequestStatus?: RequestStatus
}

// Từ hồ sơ: đã duyệt ⇒ id; đang chờ duyệt / bị từ chối ⇒ "Khác" + tên đã gửi
export function initialUnitChoice(p: ProfileUnits): UnitChoice {
  return {
    universityId: p.universityId ?? (p.universityRequest ? OTHER : ''),
    universityOther: p.universityRequest ?? '',
    universityStatus: p.universityRequestStatus ?? null,
    interestFieldIds: p.interestFieldIds ?? (p.interestFieldId ? [p.interestFieldId] : []),
    interestFieldOther: p.interestFieldRequest ?? '',
    interestFieldStatus: p.interestFieldRequestStatus ?? null
  }
}

// Sang dữ liệu gửi API: "Khác" mà không nhập tên ⇒ coi như bỏ chọn
export function unitChoicePayload(c: UnitChoice): UnitChoiceInput {
  const pick = (id: string, other: string) => (id === OTHER ? { id: null, other: other.trim() || null } : { id: id || null, other: null })
  const uni = pick(c.universityId, c.universityOther)
  return { universityId: uni.id, universityOther: uni.other, interestFieldIds: c.interestFieldIds, interestFieldOther: c.interestFieldOther.trim() || null }
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

interface FieldsPickerProps {
  options: { id: string; name: string }[]
  ids: string[]
  other: string
  status: RequestStatus
  onChange: (ids: string[], other: string) => void
}

// Lĩnh vực quan tâm: chọn nhiều (tối đa MAX_INTEREST_FIELDS), hiện dạng chip; "Khác" ⇒ đề xuất, chiếm một chỗ
function FieldsPicker({ options, ids, other, status, onChange }: FieldsPickerProps) {
  const [open, setOpen] = useState(false)
  const name = other.trim()
  const chips = ids.map((id) => options.find((o) => o.id === id)?.name).filter((n): n is string => !!n)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={FIELD} aria-label="Lĩnh vực quan tâm">
        <span className={LABEL}>
          Lĩnh vực quan tâm · tối đa {MAX_INTEREST_FIELDS}
        </span>
        <span className="flex items-center justify-between gap-2">
          {chips.length || name ? (
            <span className="flex min-w-0 flex-wrap gap-1 py-0.5">
              {chips.map((n) => (
                <span key={n} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {n}
                </span>
              ))}
              {name && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Khác</span>}
            </span>
          ) : (
            <span className="truncate text-sm text-muted-foreground">Chọn lĩnh vực</span>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </span>
        {name && <span className={cn('block truncate text-[11px]', status === 'rejected' ? 'text-destructive' : 'text-muted-foreground')}>{`“${name}” — ${status === 'rejected' ? 'chưa được duyệt' : 'chờ duyệt'}`}</span>}
      </button>
      <SuggestPickerDialog
        open={open}
        onOpenChange={setOpen}
        title="Chọn lĩnh vực quan tâm"
        options={options}
        multi={{ max: MAX_INTEREST_FIELDS, values: ids, reserved: name ? 1 : 0, onChange: (next) => onChange(next, other) }}
        suggest={{
          noun: 'lĩnh vực',
          fields: [{ key: 'name', label: 'Tên lĩnh vực', required: true, maxLength: 200, placeholder: 'Nhập tên lĩnh vực' }],
          successMessage: 'Đã ghi nhận. Bấm Lưu để gửi cho quản trị viên duyệt',
          onSubmit: (v) => onChange(ids, v.name.trim())
        }}
      />
    </>
  )
}

// Chỉ hai thông tin: trường đại học và lĩnh vực quan tâm. "Khác" ⇒ nhập tên, admin duyệt rồi hồ sơ mới cập nhật.
export function UnitSelector({ value, onChange }: UnitSelectorProps) {
  const { data } = useUnits()
  const pending = value.universityId === OTHER || !!value.interestFieldOther.trim()

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
      <FieldsPicker
        options={data?.fields ?? []}
        ids={value.interestFieldIds}
        other={value.interestFieldOther}
        status={value.interestFieldStatus}
        onChange={(interestFieldIds, interestFieldOther) => onChange({ ...value, interestFieldIds, interestFieldOther, interestFieldStatus: interestFieldOther === value.interestFieldOther ? value.interestFieldStatus : null })}
      />
      {pending && (
        <p className="text-[11px] text-muted-foreground px-1">
          Mục &quot;Khác&quot; chờ quản trị viên duyệt: được duyệt thì hồ sơ tự cập nhật, bị từ chối thì vẫn hiển thị là &quot;Khác&quot; cho tới khi bạn chọn lại.
        </p>
      )}
    </div>
  )
}
