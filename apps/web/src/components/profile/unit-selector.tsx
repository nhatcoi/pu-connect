'use client'

import React from 'react'
import type { UnitChoiceInput } from '@pu/schemas'
import { useUnits } from '@/hooks/use-units'

// '' = chưa chọn · OTHER = "Khác" (tên tự nhập, chờ admin duyệt) · còn lại là id trong danh mục
export const OTHER = 'other'

export interface UnitChoice {
  universityId: string
  universityOther: string
  interestFieldId: string
  interestFieldOther: string
}

interface ProfileUnits {
  universityId?: string | null
  universityRequest?: string | null
  interestFieldId?: string | null
  interestFieldRequest?: string | null
}

// Từ hồ sơ: đã duyệt ⇒ id; đang chờ duyệt ⇒ "Khác" + tên đã gửi
export function initialUnitChoice(p: ProfileUnits): UnitChoice {
  return {
    universityId: p.universityId ?? (p.universityRequest ? OTHER : ''),
    universityOther: p.universityRequest ?? '',
    interestFieldId: p.interestFieldId ?? (p.interestFieldRequest ? OTHER : ''),
    interestFieldOther: p.interestFieldRequest ?? ''
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

const FIELD = 'group rounded-xl border border-input focus-within:border-primary focus-within:ring-1 focus-within:ring-primary bg-background/50 px-3 pt-2 pb-1.5 transition-all'
const LABEL = 'block text-[11px] font-medium text-muted-foreground group-focus-within:text-primary transition-colors'
const SELECT = 'w-full bg-transparent p-0 text-sm text-foreground focus:outline-none border-none cursor-pointer'
const INPUT = 'w-full bg-background text-sm rounded-xl px-3 py-2.5 border border-input focus:outline-none focus:border-primary'

interface UnitPickerProps {
  label: string
  placeholder: string
  otherPlaceholder: string
  options: { id: string; name: string }[]
  id: string
  other: string
  onChange: (id: string, other: string) => void
}

function UnitPicker({ label, placeholder, otherPlaceholder, options, id, other, onChange }: UnitPickerProps) {
  return (
    <>
      <div className={FIELD}>
        <label className={LABEL}>{label}</label>
        <select value={id} onChange={(e) => onChange(e.target.value, other)} className={SELECT}>
          <option value="" className="bg-card text-foreground">
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id} className="bg-card text-foreground">
              {o.name}
            </option>
          ))}
          <option value={OTHER} className="bg-card text-foreground">
            Khác...
          </option>
        </select>
      </div>
      {id === OTHER && <input type="text" value={other} onChange={(e) => onChange(OTHER, e.target.value)} maxLength={200} placeholder={otherPlaceholder} className={INPUT} />}
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
        otherPlaceholder="Tên trường đại học"
        options={data?.universities ?? []}
        id={value.universityId}
        other={value.universityOther}
        onChange={(universityId, universityOther) => onChange({ ...value, universityId, universityOther })}
      />
      <UnitPicker
        label="Lĩnh vực quan tâm"
        placeholder="Chọn lĩnh vực"
        otherPlaceholder="Tên lĩnh vực quan tâm"
        options={data?.fields ?? []}
        id={value.interestFieldId}
        other={value.interestFieldOther}
        onChange={(interestFieldId, interestFieldOther) => onChange({ ...value, interestFieldId, interestFieldOther })}
      />
      {pending && (
        <p className="text-[11px] text-muted-foreground px-1">
          Mục &quot;Khác&quot; sẽ chờ quản trị viên duyệt. Trong lúc chờ, hồ sơ hiển thị là &quot;Khác&quot; và tự cập nhật khi được duyệt.
        </p>
      )}
    </div>
  )
}
