import { useMemo } from 'react'
import type { SuggestConfig } from '@/components/common/suggest-picker'
import { useMyCourseSuggestions, useSuggestCourse } from '@/hooks/use-course-suggestions'
import { useUnits } from '@/hooks/use-units'

// Cấu hình "Khác ⇒ đề xuất môn học" cho hộp chọn dùng chung (SuggestPickerDialog)
export function useCourseSuggestConfig(enabled = true): SuggestConfig {
  const { data: units } = useUnits()
  const { data: mine = [] } = useMyCourseSuggestions(enabled)
  const suggest = useSuggestCourse()

  return useMemo(
    () => ({
      noun: 'môn học',
      fields: [
        { key: 'name', label: 'Tên môn học', required: true, maxLength: 150, placeholder: 'Vd. An toàn thông tin' },
        { key: 'fieldId', label: 'Lĩnh vực', type: 'select' as const, options: (units?.fields ?? []).map((f) => ({ value: f.id, label: f.name })) },
        { key: 'note', label: 'Ghi chú', maxLength: 500, placeholder: 'Mã môn, giảng viên… (tùy chọn)' }
      ],
      onSubmit: (v: Record<string, string>) => suggest.mutateAsync({ name: v.name.trim(), fieldId: v.fieldId || undefined, note: v.note?.trim() || undefined }),
      history: mine.map((s) => ({ id: s.id, name: s.name, status: s.status, note: s.reviewNote }))
    }),
    [units, mine, suggest.mutateAsync] // eslint-disable-line react-hooks/exhaustive-deps -- mutateAsync ổn định
  )
}
