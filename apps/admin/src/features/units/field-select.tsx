import React from 'react'
import { Select } from '@/components/ui'
import { useAdminUnits } from './use-units'

// Chọn lĩnh vực quan tâm (môn học gắn theo lĩnh vực); trống = chưa phân loại
export function FieldSelect({ value, onChange }: { value: string | null | undefined; onChange: (id: string | null) => void }) {
  const { data } = useAdminUnits()
  return (
    <Select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">Chưa phân loại</option>
      {(data?.fields ?? [])
        .filter((f) => f.isActive || f.id === value)
        .map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
    </Select>
  )
}
