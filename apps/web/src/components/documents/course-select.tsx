'use client'

import React, { useMemo, useState } from 'react'
import type { Course } from '@pu/schemas'
import { ChevronDown } from 'lucide-react'
import { SuggestPickerDialog } from '@/components/common/suggest-picker'
import { useCourseSuggestConfig } from '@/components/courses/use-course-suggest-config'
import { cn } from '@/lib/utils'

interface CourseSelectProps {
  courses: Course[]
  value: string
  onChange: (value: string) => void
  placeholder: string
  // Giá trị trả về: id môn (phân loại) hoặc mã môn (bộ lọc)
  valueBy?: 'id' | 'code'
  // Có dòng "Khác ⇒ đề xuất môn" (mặc định bật khi chọn môn để phân loại, tắt ở bộ lọc)
  suggest?: boolean
  className?: string
}

// Chọn môn học: hộp A–Z có ô tìm (tên + mã). Môn chưa có ⇒ "Khác" ⇒ đề xuất, admin duyệt
export function CourseSelect({ courses, value, onChange, placeholder, valueBy = 'id', suggest = valueBy === 'id', className }: CourseSelectProps) {
  const [open, setOpen] = useState(false)
  const suggestConfig = useCourseSuggestConfig(open && suggest)
  const keyOf = (c: Course) => (valueBy === 'code' ? c.code : c.id)
  const selected = courses.find((c) => keyOf(c) === value)
  const options = useMemo(() => courses.map((c) => ({ id: keyOf(c), name: c.name, hint: c.code })), [courses, valueBy]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <button
        type="button"
        aria-label="Môn học"
        onClick={() => setOpen(true)}
        className={cn(
          'flex h-8 min-w-0 items-center justify-between gap-1 rounded-lg border border-input bg-background px-2 text-left text-xs text-foreground cursor-pointer focus:outline-none focus:border-primary',
          className
        )}
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>{selected ? selected.name : placeholder}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
      <SuggestPickerDialog
        open={open}
        onOpenChange={setOpen}
        title="Chọn môn học"
        options={options}
        value={value}
        clearLabel={value ? placeholder.replace(/ \*$/, '') : undefined}
        onSelect={(id) => onChange(id ?? '')}
        suggest={suggest ? suggestConfig : undefined}
      />
    </>
  )
}
