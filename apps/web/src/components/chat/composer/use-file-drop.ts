'use client'

import { useEffect } from 'react'
import { create } from 'zustand'
import { ChatAttachmentSchema, type ChatAttachment } from '@pu/schemas'

// Kéo 1 tệp đã tải lên (thẻ tệp trong chat, hàng ở panel tài liệu) thả vào ô chat / panel ⇒ dùng lại, không tải lên nữa
export const ATTACHMENT_DRAG_TYPE = 'application/x-n7ai-attachment'
// Vùng thả riêng (panel tài liệu, thư viện) tự xử lý sự kiện; ô chat bỏ qua thả trong các vùng này
const ZONE_SELECTOR = '[data-drop-zone]'

export function startAttachmentDrag(e: React.DragEvent, attachment: ChatAttachment) {
  e.dataTransfer.setData(ATTACHMENT_DRAG_TYPE, JSON.stringify(attachment))
  e.dataTransfer.effectAllowed = 'copy'
}

const carriesFiles = (e: DragEvent) => !!e.dataTransfer && (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes(ATTACHMENT_DRAG_TYPE))

export type DropPayload = { files: File[]; attachment: ChatAttachment | null }

// Lấy tệp từ máy hoặc tệp đã tải lên (kiểm bằng schema) từ sự kiện thả
export function readDrop(e: { dataTransfer: DataTransfer | null }): DropPayload {
  const files = Array.from(e.dataTransfer?.files ?? [])
  if (files.length) return { files, attachment: null }
  try {
    const parsed = ChatAttachmentSchema.safeParse(JSON.parse(e.dataTransfer?.getData(ATTACHMENT_DRAG_TYPE) || 'null'))
    return { files: [], attachment: parsed.success ? parsed.data : null }
  } catch {
    return { files: [], attachment: null }
  }
}

// Trạng thái kéo toàn cửa sổ: đang kéo tệp? đang ở trong một vùng thả riêng?
const useDragState = create<{ active: boolean; overZone: boolean }>(() => ({ active: false, overZone: false }))

let monitors = 0
let stopMonitor: (() => void) | null = null

// Một bộ lắng nghe chung cho cả trang (dùng chung giữa ô chat và các vùng thả)
function startMonitor() {
  let depth = 0 // dragenter / dragleave bắn theo từng phần tử con
  const reset = () => {
    depth = 0
    useDragState.setState({ active: false, overZone: false })
  }
  const onEnter = (e: DragEvent) => {
    if (!carriesFiles(e)) return
    depth++
    useDragState.setState({ active: true })
  }
  const onOver = (e: DragEvent) => {
    if (!carriesFiles(e)) return
    e.preventDefault() // bắt buộc để được thả, và không cho trình duyệt mở tệp thả ra ngoài vùng
    const overZone = e.target instanceof Element && !!e.target.closest(ZONE_SELECTOR)
    if (useDragState.getState().overZone !== overZone) useDragState.setState({ overZone })
  }
  const onLeave = (e: DragEvent) => {
    if (!carriesFiles(e)) return
    depth = Math.max(0, depth - 1)
    if (depth === 0) reset()
  }
  window.addEventListener('dragenter', onEnter)
  window.addEventListener('dragover', onOver)
  window.addEventListener('dragleave', onLeave)
  window.addEventListener('drop', reset)
  window.addEventListener('dragend', reset)
  return () => {
    window.removeEventListener('dragenter', onEnter)
    window.removeEventListener('dragover', onOver)
    window.removeEventListener('dragleave', onLeave)
    window.removeEventListener('drop', reset)
    window.removeEventListener('dragend', reset)
    reset()
  }
}

// Gọi ở mọi thành phần cần biết trạng thái kéo
export function useDragMonitor(): { active: boolean; overZone: boolean } {
  useEffect(() => {
    if (monitors++ === 0) stopMonitor = startMonitor()
    return () => {
      if (--monitors === 0) stopMonitor?.()
    }
  }, [])
  return useDragState()
}

// Ô chat: thả tệp vào bất kỳ đâu ngoài các vùng thả riêng ⇒ đính kèm vào tin nhắn. Trả về true khi cần hiện gợi ý "thả để đính kèm"
export function useChatFileDrop(enabled: boolean, onFiles: (files: File[]) => void, onAttachment: (attachment: ChatAttachment) => void): boolean {
  const { active, overZone } = useDragMonitor()
  useEffect(() => {
    if (!enabled) return
    const onDrop = (e: DragEvent) => {
      if (!carriesFiles(e) || (e.target instanceof Element && e.target.closest(ZONE_SELECTOR))) return
      e.preventDefault()
      const { files, attachment } = readDrop(e)
      if (files.length) onFiles(files)
      else if (attachment) onAttachment(attachment)
    }
    window.addEventListener('drop', onDrop)
    return () => window.removeEventListener('drop', onDrop)
  }, [enabled, onFiles, onAttachment])
  return enabled && active && !overZone
}
