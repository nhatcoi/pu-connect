'use client'

import { create } from 'zustand'
import type { AiSource } from '@pu/schemas'
import { useFilePreview } from '@/components/viewer/file-preview-panel'
import type { DocEntry } from './doc-entries'

// Tài liệu dạng chữ (văn bản dán, trang web, YouTube) đang xem; seq tăng mỗi lần mở để panel tự bung ra
export const useSourceView = create<{ source: AiSource | null; seq: number; open: (source: AiSource) => void; close: () => void }>((set) => ({
  source: null,
  seq: 0,
  open: (source) => set((s) => ({ source, seq: s.seq + 1 })),
  close: () => set({ source: null })
}))

// Mở 1 tài liệu bất kỳ: tệp ⇒ trình xem tệp, còn lại ⇒ trình xem chữ; chỉ một trong hai hiện cùng lúc
export function openDoc(entry: DocEntry) {
  if (entry.attachment) {
    useSourceView.getState().close()
    useFilePreview.getState().open(entry.attachment)
  } else if (entry.source) {
    useFilePreview.getState().close()
    useSourceView.getState().open(entry.source)
  }
}
