'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { searchAcademicUnits, inferAcademicHierarchy, PHENIKAA_ACADEMIC_YEARS, type AcademicUnitItem } from '@pu/schemas'
import { GraduationCap, Search, Check, X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AcademicUnitSelectorProps {
  school?: string | null
  faculty?: string | null
  major?: string | null
  academicYear?: string | null
  className?: string | null
  onChange: (values: { school: string | null; faculty: string | null; major: string | null; academicYear: string | null; className: string | null }) => void
}

export function AcademicUnitSelector({ school, faculty, major, academicYear, className, onChange }: AcademicUnitSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isCustomMode, setIsCustomMode] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Tìm kiếm kết quả
  const searchResults = useMemo(() => {
    return searchAcademicUnits(searchQuery, 12)
  }, [searchQuery])

  // Lựa chọn một đơn vị học thuật
  const handleSelectUnit = (unit: AcademicUnitItem) => {
    const inferred = inferAcademicHierarchy(unit.name)
    onChange({
      school: inferred.school,
      faculty: inferred.faculty,
      major: inferred.major,
      academicYear: academicYear || null,
      className: className || null
    })
    setSearchQuery('')
    setIsOpen(false)
    setIsCustomMode(false)
  }

  // Xóa lựa chọn đơn vị
  const handleClearUnit = () => {
    onChange({
      school: null,
      faculty: null,
      major: null,
      academicYear: academicYear || null,
      className: className || null
    })
    setSearchQuery('')
  }

  // Tên hiển thị chính hiện tại
  const currentPrimaryTitle = major || faculty || school || ''

  return (
    <div className="space-y-3.5" ref={containerRef}>
      {/* 1. Đơn vị học thuật / Chuyên ngành đào tạo */}
      <div className="relative">
        <label className="block text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <GraduationCap className="h-3.5 w-3.5 text-primary" />
            <span>Ngành học / Đơn vị trực thuộc (School • Faculty • Major)</span>
          </span>
          {currentPrimaryTitle && !isCustomMode && (
            <button
              type="button"
              onClick={handleClearUnit}
              className="text-[10px] text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
            >
              Đặt lại
            </button>
          )}
        </label>

        {!isCustomMode ? (
          <div className="relative">
            {/* Thanh hiển thị & ô tìm kiếm thông minh */}
            <div
              onClick={() => setIsOpen(true)}
              className={cn(
                'min-h-[46px] w-full rounded-xl border border-input bg-background/60 hover:border-foreground/30 px-3 py-2 flex items-center justify-between gap-2 cursor-pointer transition-all',
                isOpen && 'border-primary ring-1 ring-primary'
              )}
            >
              {currentPrimaryTitle ? (
                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm text-foreground truncate">{currentPrimaryTitle}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">{[school, faculty].filter(Boolean).join(' • ') || 'Đại học Phenikaa'}</div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground/70 text-sm">
                  <Search className="h-4 w-4" />
                  <span>Chọn ngành hoặc gõ tìm kiếm (vd: KTPM, AI, Luật, Nano...)</span>
                </div>
              )}

              <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform shrink-0', isOpen && 'rotate-180 text-foreground')} />
            </div>

            {/* Dropdown danh sách kết quả */}
            {isOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Search input trong dropdown */}
                <div className="p-2 border-b border-border flex items-center gap-2 bg-muted/30">
                  <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm theo tên ngành, khoa, trường, viện, mã viết tắt..."
                    className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                  />
                  {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery('')} className="p-1 hover:bg-muted rounded text-muted-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Danh sách items */}
                <div className="max-h-60 overflow-y-auto p-1.5 space-y-1 divide-y divide-border/40">
                  {searchResults.length > 0 ? (
                    searchResults.map((item) => {
                      const isSelected = item.name === major || item.name === faculty || item.name === school

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectUnit(item)}
                          className={cn(
                            'w-full text-left p-2 rounded-lg transition-colors flex items-start justify-between gap-2 cursor-pointer pt-1.5',
                            isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/70 text-foreground'
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold truncate">{item.name}</span>
                              {item.type === 'school' && (
                                <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.2 rounded border border-blue-500/20 shrink-0">
                                  Trường
                                </span>
                              )}
                              {item.type === 'faculty' && (
                                <span className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1.5 py-0.2 rounded border border-purple-500/20 shrink-0">
                                  Khoa
                                </span>
                              )}
                              {item.type === 'major' && (
                                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/20 shrink-0">
                                  Ngành
                                </span>
                              )}
                              {item.type === 'institute' && (
                                <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 rounded border border-amber-500/20 shrink-0">
                                  Viện
                                </span>
                              )}
                              {item.type === 'center' && (
                                <span className="text-[10px] bg-teal-500/10 text-teal-600 dark:text-teal-400 px-1.5 py-0.2 rounded border border-teal-500/20 shrink-0">
                                  Trung tâm
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                              {[item.schoolName, item.facultyName].filter(Boolean).join(' • ') || 'Đơn vị trực thuộc Đại học Phenikaa'}
                            </p>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                        </button>
                      )
                    })
                  ) : (
                    <div className="py-4 text-center text-xs text-muted-foreground">Không tìm thấy kết quả phù hợp</div>
                  )}

                  {/* Nút chuyển sang nhập tự do nếu là ngành/đơn vị đặc biệt */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomMode(true)
                        setIsOpen(false)
                      }}
                      className="w-full text-center py-1.5 text-xs text-primary hover:underline font-medium cursor-pointer"
                    >
                      + Nhập ngành / đơn vị tùy chỉnh khác
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Chế độ nhập tự do (Custom Mode) */
          <div className="space-y-2 p-3 bg-muted/30 rounded-xl border border-border animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Nhập thông tin đào tạo tùy chỉnh:</span>
              <button type="button" onClick={() => setIsCustomMode(false)} className="text-xs text-primary hover:underline cursor-pointer">
                Quay lại danh mục chuẩn
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={school || ''}
                onChange={(e) =>
                  onChange({
                    school: e.target.value || null,
                    faculty: faculty || null,
                    major: major || null,
                    academicYear: academicYear || null,
                    className: className || null
                  })
                }
                placeholder="Tên Trường (vd: Trường CNTT)"
                className="w-full bg-background text-xs rounded-lg px-2.5 py-1.5 border border-border focus:outline-none focus:border-primary"
              />
              <input
                type="text"
                value={faculty || ''}
                onChange={(e) =>
                  onChange({
                    school: school || null,
                    faculty: e.target.value || null,
                    major: major || null,
                    academicYear: academicYear || null,
                    className: className || null
                  })
                }
                placeholder="Tên Khoa / Viện (vd: Khoa KHMT)"
                className="w-full bg-background text-xs rounded-lg px-2.5 py-1.5 border border-border focus:outline-none focus:border-primary"
              />
            </div>
            <input
              type="text"
              value={major || ''}
              onChange={(e) =>
                onChange({
                  school: school || null,
                  faculty: faculty || null,
                  major: e.target.value || null,
                  academicYear: academicYear || null,
                  className: className || null
                })
              }
              placeholder="Tên Chuyên ngành đào tạo"
              className="w-full bg-background text-xs rounded-lg px-2.5 py-1.5 border border-border focus:outline-none focus:border-primary"
            />
          </div>
        )}
      </div>

      {/* 2. Niên khóa & Lớp sinh hoạt (Optional & Tùy chọn) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Niên khóa / Khóa sinh viên */}
        <div className="group relative rounded-xl border border-input focus-within:border-primary focus-within:ring-1 focus-within:ring-primary bg-background/50 hover:border-foreground/25 px-3 pt-2 pb-1.5 transition-all">
          <label className="block text-[11px] font-medium text-muted-foreground group-focus-within:text-primary transition-colors">
            Khóa sinh viên (Cohort)
          </label>
          <select
            value={academicYear || ''}
            onChange={(e) =>
              onChange({
                school: school || null,
                faculty: faculty || null,
                major: major || null,
                academicYear: e.target.value || null,
                className: className || null
              })
            }
            className="w-full bg-transparent p-0 text-sm text-foreground focus:outline-none border-none cursor-pointer"
          >
            <option value="" className="bg-card text-foreground">
              -- Chọn khóa (Optional) --
            </option>
            {PHENIKAA_ACADEMIC_YEARS.map((y) => (
              <option key={y.code} value={y.code} className="bg-card text-foreground">
                {y.label}
              </option>
            ))}
          </select>
        </div>

        {/* Lớp sinh hoạt */}
        <div className="group relative rounded-xl border border-input focus-within:border-primary focus-within:ring-1 focus-within:ring-primary bg-background/50 hover:border-foreground/25 px-3 pt-2 pb-1.5 transition-all">
          <label className="block text-[11px] font-medium text-muted-foreground group-focus-within:text-primary transition-colors">Lớp sinh hoạt (Class)</label>
          <input
            type="text"
            value={className || ''}
            onChange={(e) =>
              onChange({
                school: school || null,
                faculty: faculty || null,
                major: major || null,
                academicYear: academicYear || null,
                className: e.target.value || null
              })
            }
            placeholder={major && academicYear ? `VD: ${academicYear}-${major.slice(0, 4).toUpperCase()}1` : 'VD: K17-KTPM1...'}
            className="w-full bg-transparent p-0 text-sm text-foreground focus:outline-none border-none placeholder:text-muted-foreground/50"
          />
        </div>
      </div>
    </div>
  )
}
