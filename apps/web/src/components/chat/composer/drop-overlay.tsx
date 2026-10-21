import React from 'react'
import { FileUp } from 'lucide-react'

// Phủ toàn trang khi đang kéo tệp (không chặn chuột: sự kiện thả do cửa sổ xử lý)
export function DropOverlay() {
  return (
    <div className="pointer-events-none fixed inset-3 z-[70] flex items-center justify-center rounded-3xl border-2 border-dashed border-primary/60 bg-primary/5 backdrop-blur-[2px] animate-in fade-in duration-150">
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-card px-8 py-6 text-center shadow-xl ring-1 ring-border">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <FileUp className="h-6 w-6" />
        </span>
        <p className="text-sm font-semibold">Thả tệp để đính kèm</p>
        <p className="text-xs text-muted-foreground">PDF, Word, slide, bảng tính, ảnh, mã nguồn · tối đa 25 MB</p>
      </div>
    </div>
  )
}
