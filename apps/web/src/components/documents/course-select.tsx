'use client'

import React, { useMemo, useState } from 'react'
import type { Course } from '@pu/schemas'
import { Check, ChevronDown, Search } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface CourseSelectProps {
  courses: Course[]
  value: string
  onChange: (value: string) => void
  placeholder: string
  // Giá trị trả về: id môn (phân loại) hoặc mã môn (bộ lọc)
  valueBy?: 'id' | 'code'
  className?: string
}

// Bỏ dấu để "giai tich" khớp "Giải tích"
const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

// Chọn môn học có ô tìm. Hiển thị tên môn (mã có thể trùng / đổi), vẫn tìm được theo mã
export function CourseSelect({ courses, value, onChange, placeholder, valueBy = 'id', className }: CourseSelectProps) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const keyOf = (c: Course) => (valueBy === 'code' ? c.code : c.id)
  const selected = courses.find((c) => keyOf(c) === value)

  const filtered = useMemo(() => {
    const needle = normalize(q.trim())
    return needle ? courses.filter((c) => normalize(`${c.name} ${c.code}`).includes(needle)) : courses
  }, [courses, q])

  const pick = (next: string) => {
    onChange(next)
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setQ('')
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Môn học"
          className={cn(
            'flex h-8 min-w-0 items-center justify-between gap-1 rounded-lg border border-input bg-background px-2 text-left text-xs text-foreground cursor-pointer focus:outline-none focus:border-primary',
            className
          )}
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>{selected ? selected.name : placeholder}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-64 p-1.5">
        <div className="relative mb-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm môn học…"
            className="h-8 w-full rounded-md bg-muted/50 pl-7 pr-2 text-xs outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-60 overflow-y-auto">
          <button type="button" onClick={() => pick('')} className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted cursor-pointer">
            {placeholder}
          </button>
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pick(keyOf(c))}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted cursor-pointer"
            >
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              {keyOf(c) === value && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
            </button>
          ))}
          {filtered.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">Không thấy môn phù hợp</p>}
        </div>
      </PopoverContent>
    </Popover>
  )
}
