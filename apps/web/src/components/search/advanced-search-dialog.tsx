'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SlidersHorizontal } from 'lucide-react'

type SearchType = 'all' | 'posts' | 'documents' | 'courses' | 'groups'

interface AdvancedSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialQuery?: string
  initialFaculty?: string
}

const FACULTIES = [
  { code: 'ALL', name: 'Tất cả Khoa / Viện' },
  { code: 'FIT', name: 'Khoa Công nghệ Thông tin (FIT)' },
  { code: 'FCS', name: 'Khoa Khoa học Máy tính (FCS)' },
  { code: 'FEE', name: 'Khoa Điện - Điện tử (FEE)' },
  { code: 'FBA', name: 'Khoa Kinh tế & QTKD (FBA)' },
  { code: 'FAE', name: 'Khoa Kỹ thuật Ô tô (FAE)' },
  { code: 'FMS', name: 'Khoa Y Dược (FMS)' },
  { code: 'FEL', name: 'Khoa Ngôn ngữ Anh (FEL)' },
  { code: 'FAS', name: 'Khoa Vật liệu & Công nghệ cao (FAS)' }
]

export function AdvancedSearchDialog({
  open,
  onOpenChange,
  initialQuery = '',
  initialFaculty = 'ALL'
}: AdvancedSearchDialogProps) {
  const router = useRouter()
  const [exactWords, setExactWords] = useState(initialQuery)
  const [tag, setTag] = useState('')
  const [faculty, setFaculty] = useState(initialFaculty)
  const [searchType, setSearchType] = useState<SearchType>('all')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    let q = exactWords.trim()
    if (tag.trim()) {
      const cleanTag = tag.trim().startsWith('#') ? tag.trim() : `#${tag.trim()}`
      q = q ? `${q} ${cleanTag}` : cleanTag
    }

    if (!q) return

    const facultyParam = faculty !== 'ALL' ? `&faculty=${faculty}` : ''
    const typeParam = searchType !== 'all' ? `&type=${searchType}` : ''
    
    onOpenChange(false)
    router.push(`/search?q=${encodeURIComponent(q)}${typeParam}${facultyParam}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden rounded-2xl border-border bg-card shadow-2xl">
        <DialogHeader className="p-4 border-b border-border">
          <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <span>Tìm kiếm nâng cao (Advanced search)</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Exact phrase / keywords */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Từ khóa hoặc tiêu đề
            </label>
            <Input
              value={exactWords}
              onChange={(e) => setExactWords(e.target.value)}
              placeholder="ví dụ: Giải tích 2, Đồ án tốt nghiệp, React..."
              className="rounded-xl h-10 text-xs"
            />
          </div>

          {/* Tag search */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Thẻ chủ đề / Mã học phần (Hashtag)
            </label>
            <Input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="ví dụ: #IT101, #DoAnTotNghiep, #FIT"
              className="rounded-xl h-10 text-xs"
            />
          </div>

          {/* Faculty select */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Khoa / Viện đào tạo
            </label>
            <select
              value={faculty}
              onChange={(e) => setFaculty(e.target.value)}
              className="w-full h-10 rounded-xl border border-input bg-background px-3 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {FACULTIES.map((fac) => (
                <option key={fac.code} value={fac.code}>
                  {fac.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Phân loại nội dung tìm kiếm
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'posts', label: 'Bài viết Q&A' },
                { id: 'documents', label: 'Tài liệu & Đề thi' },
                { id: 'courses', label: 'Môn học' },
                { id: 'groups', label: 'Nhóm PBL' }
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSearchType(item.id as SearchType)}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border transition-colors cursor-pointer text-center ${
                    searchType === item.id
                      ? 'bg-primary text-primary-foreground border-primary font-bold'
                      : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-full text-xs font-semibold"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              className="rounded-full text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Tìm kiếm
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
