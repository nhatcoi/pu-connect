'use client'

import React, { useState, useMemo } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Search, Check, X, GraduationCap } from 'lucide-react'
import { useAppStore } from '@/store'

interface ComposerCoursePickerProps {
  selectedCourseId?: string
  onChange: (courseId?: string) => void
}

const DEFAULT_COURSES = [
  { id: 'CS101', code: 'CS101', name: 'Nhập môn Lập trình', faculty: 'FIT' },
  { id: 'CS102', code: 'CS102', name: 'Cấu trúc Dữ liệu & Giải thuật', faculty: 'FIT' },
  { id: 'CS201', code: 'CS201', name: 'Cơ sở Dữ liệu', faculty: 'FIT' },
  { id: 'CS301', code: 'CS301', name: 'Lập trình Web & Ứng dụng', faculty: 'FIT' },
  { id: 'CS305', code: 'CS305', name: 'Trí tuệ Nhân tạo & Học máy', faculty: 'FIT' },
  { id: 'MAT101', code: 'MAT101', name: 'Giải tích 1', faculty: 'FCS' },
  { id: 'MAT102', code: 'MAT102', name: 'Đại số Tuyến tính', faculty: 'FCS' },
  { id: 'PHY101', code: 'PHY101', name: 'Vật lý Đại cương 1', faculty: 'FEE' },
  { id: 'ENG101', code: 'ENG101', name: 'Tiếng Anh Học thuật 1', faculty: 'FL' },
  { id: 'PBL3', code: 'PBL3', name: 'Đồ án PBL Chuyên ngành', faculty: 'FIT' }
]

export function ComposerCoursePicker({
  selectedCourseId,
  onChange
}: ComposerCoursePickerProps) {
  const storeCourses = useAppStore((state) => state.courses)
  const [search, setSearch] = useState('')

  const courseList = useMemo(() => {
    if (storeCourses && storeCourses.length > 0) {
      return storeCourses
    }
    return DEFAULT_COURSES
  }, [storeCourses])

  const filteredCourses = useMemo(() => {
    if (!search.trim()) return courseList
    const query = search.toLowerCase()
    return courseList.filter(
      (c) =>
        c.code.toLowerCase().includes(query) ||
        c.name.toLowerCase().includes(query)
    )
  }, [courseList, search])

  const selectedCourse = courseList.find((c) => c.id === selectedCourseId || c.code === selectedCourseId)

  return (
    <div className="flex items-center gap-1 max-w-full">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all duration-150 cursor-pointer outline-none max-w-[160px] sm:max-w-[220px] ${
              selectedCourse
                ? 'bg-primary/10 border-primary/40 text-primary'
                : 'border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
            }`}
          >
            <GraduationCap className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {selectedCourse ? `${selectedCourse.code} - ${selectedCourse.name}` : 'Gắn môn học'}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72 p-2 space-y-2 rounded-2xl shadow-xl border border-border">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-muted/60 border border-border">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Tìm mã hoặc tên môn học..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              autoFocus
            />
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
            {filteredCourses.length > 0 ? (
              filteredCourses.map((course) => {
                const isSelected = selectedCourseId === course.id || selectedCourseId === course.code
                return (
                  <DropdownMenuItem
                    key={course.id}
                    onClick={() => onChange(course.id)}
                    className="flex items-center justify-between p-2 rounded-xl cursor-pointer text-xs"
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="font-bold text-foreground truncate">
                        {course.code}
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate">
                        {course.name}
                      </span>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </DropdownMenuItem>
                )
              })
            ) : (
              <div className="p-3 text-center text-xs text-muted-foreground">
                Không tìm thấy học phần phù hợp
              </div>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedCourse && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors cursor-pointer shrink-0"
          title="Bỏ chọn môn"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
