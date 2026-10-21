'use client'

import { useEffect, useState } from 'react'
import { ChatAttachmentSchema, type ChatAttachment } from '@pu/schemas'

// Kéo 1 tệp đã tải lên (từ panel tài liệu, thẻ tệp trong chat) thả vào ô chat ⇒ đính kèm lại, không tải lên nữa
export const ATTACHMENT_DRAG_TYPE = 'application/x-n7ai-attachment'

export function startAttachmentDrag(e: React.DragEvent, attachment: ChatAttachment) {
  e.dataTransfer.setData(ATTACHMENT_DRAG_TYPE, JSON.stringify(attachment))
  e.dataTransfer.effectAllowed = 'copy'
}

const carriesFiles = (e: DragEvent) => !!e.dataTransfer && (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes(ATTACHMENT_DRAG_TYPE))

function readAttachment(e: DragEvent): ChatAttachment | null {
  try {
    const parsed = ChatAttachmentSchema.safeParse(JSON.parse(e.dataTransfer?.getData(ATTACHMENT_DRAG_TYPE) || 'null'))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

// Cả trang là vùng thả (không chỉ ô soạn tin); trả về true khi đang kéo tệp ngang qua cửa sổ
export function useChatFileDrop(enabled: boolean, onFiles: (files: File[]) => void, onAttachment: (attachment: ChatAttachment) => void): boolean {
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let depth = 0 // dragenter / dragleave bắn theo từng phần tử con
    const reset = () => {
      depth = 0
      setDragging(false)
    }
    const onEnter = (e: DragEvent) => {
      if (!carriesFiles(e)) return
      depth++
      setDragging(true)
    }
    const onOver = (e: DragEvent) => {
      if (!carriesFiles(e)) return
      e.preventDefault() // bắt buộc để được phép thả (và không cho trình duyệt mở tệp)
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onLeave = (e: DragEvent) => {
      if (!carriesFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onDrop = (e: DragEvent) => {
      if (!carriesFiles(e)) return
      e.preventDefault()
      reset()
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (files.length) return onFiles(files)
      const attachment = readAttachment(e)
      if (attachment) onAttachment(attachment)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    window.addEventListener('dragend', reset)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('dragend', reset)
      reset()
    }
  }, [enabled, onFiles, onAttachment])

  return dragging
}
