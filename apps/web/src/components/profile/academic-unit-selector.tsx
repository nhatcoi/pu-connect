'use client'

import React, { useMemo, useState } from 'react'
import { PHENIKAA_UNIVERSITY_NAME } from '@pu/schemas'
import { useAcademicUnits } from '@/hooks/use-academic-units'

interface AcademicUnitSelectorProps {
  school?: string | null
  faculty?: string | null
  major?: string | null
  academicYear?: string | null
  className?: string | null
  // unitId: có mặt khi đổi trường (id = chọn từ danh sách, null = nhập tay / xóa); vắng mặt khi không đổi
  onChange: (values: { school: string | null; faculty: string | null; major: string | null; academicYear: string | null; className: string | null; unitId?: string | null }) => void
}

const FIELD = 'group rounded-xl border border-input focus-within:border-primary focus-within:ring-1 focus-within:ring-primary bg-background/50 px-3 pt-2 pb-1.5 transition-all'
const LABEL = 'block text-[11px] font-medium text-muted-foreground group-focus-within:text-primary transition-colors'

// Chỉ chọn đại học + trường thành viên; khoa / ngành / khóa / lớp tạm bỏ (thêm lại khi có cây đơn vị chi tiết)
// University + member school only; faculty / major / cohort / class are hidden for now
export function AcademicUnitSelector({ school, faculty, major, academicYear, className, onChange }: AcademicUnitSelectorProps) {
  // Đại học: mặc định Phenikaa (school = trường thành viên); trường khác ⇒ school lưu tên trường, nhập tay
  const [forceOther, setForceOther] = useState(false)
  const isOtherUni = forceOther || (!!school && !/phenikaa/i.test(school))
  const { data: units = [] } = useAcademicUnits()
  const schools = useMemo(() => units.filter((u) => u.type === 'school'), [units])
  // Giữ nguyên các giá trị cũ không còn hiển thị (khoa/ngành/khóa/lớp) khi chỉ đổi trường
  const keep = { academicYear: academicYear || null, className: className || null }

  return (
    <div className="space-y-3.5">
      <div className={FIELD}>
        <label className={LABEL}>Trường đại học</label>
        <select
          value={isOtherUni ? 'other' : 'phenikaa'}
          onChange={(e) => {
            setForceOther(e.target.value === 'other')
            onChange({ school: null, faculty: null, major: null, unitId: null, ...keep })
          }}
          className="w-full bg-transparent p-0 text-sm text-foreground focus:outline-none border-none cursor-pointer"
        >
          <option value="phenikaa" className="bg-card text-foreground">
            {PHENIKAA_UNIVERSITY_NAME}
          </option>
          <option value="other" className="bg-card text-foreground">
            Trường khác...
          </option>
        </select>
      </div>

      {isOtherUni ? (
        <input
          type="text"
          value={school || ''}
          onChange={(e) => onChange({ school: e.target.value || null, faculty: faculty || null, major: major || null, unitId: null, ...keep })}
          placeholder="Tên trường đại học"
          className="w-full bg-background text-sm rounded-xl px-3 py-2.5 border border-input focus:outline-none focus:border-primary"
        />
      ) : (
        <div className={FIELD}>
          <label className={LABEL}>Trường thành viên</label>
          <select
            value={schools.find((u) => u.name === school)?.id ?? ''}
            onChange={(e) => {
              const unit = schools.find((u) => u.id === e.target.value)
              onChange({ school: unit?.name ?? null, faculty: null, major: null, unitId: unit?.id ?? null, ...keep })
            }}
            className="w-full bg-transparent p-0 text-sm text-foreground focus:outline-none border-none cursor-pointer"
          >
            <option value="" className="bg-card text-foreground">
              Chọn trường
            </option>
            {schools.map((u) => (
              <option key={u.id} value={u.id} className="bg-card text-foreground">
                {u.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
