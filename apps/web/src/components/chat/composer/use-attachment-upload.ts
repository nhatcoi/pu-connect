'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CHAT_MAX_ATTACHMENTS, type ChatAttachment } from '@pu/schemas'
import { attachmentError, uploadChatFile } from './attachment-files'

export type PendingFile = {
  id: string
  name: string
  size: number
  previewUrl: string | null // ảnh: object URL để xem trước
  progress: number // 0–100
  status: 'uploading' | 'done' | 'error'
  result?: ChatAttachment
}

// Hàng đợi tệp đính kèm của ô soạn tin: tải ngay khi chọn, gửi khi xong
export function useAttachmentUpload() {
  const [files, setFiles] = useState<PendingFile[]>([])
  const aborts = useRef(new Map<string, () => void>())
  const filesRef = useRef(files)
  filesRef.current = files

  // Dọn object URL khi rời trang
  useEffect(
    () => () => {
      for (const f of filesRef.current) if (f.previewUrl) URL.revokeObjectURL(f.previewUrl)
      for (const abort of aborts.current.values()) abort()
    },
    []
  )

  const patch = (id: string, p: Partial<PendingFile>) => setFiles((list) => list.map((f) => (f.id === id ? { ...f, ...p } : f)))

  const add = useCallback((input: FileList | File[]) => {
    const picked = Array.from(input)
    const room = CHAT_MAX_ATTACHMENTS - filesRef.current.length
    if (picked.length > room) toast.error(`Tối đa ${CHAT_MAX_ATTACHMENTS} tệp mỗi tin`)
    for (const file of picked.slice(0, Math.max(0, room))) {
      const error = attachmentError(file)
      if (error) {
        toast.error(error)
        continue
      }
      const id = crypto.randomUUID()
      const item: PendingFile = {
        id,
        name: file.name,
        size: file.size,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        progress: 0,
        status: 'uploading'
      }
      setFiles((list) => [...list, item])
      const { promise, abort } = uploadChatFile(file, (progress) => patch(id, { progress }))
      aborts.current.set(id, abort)
      promise
        .then((result) => patch(id, { status: 'done', progress: 100, result }))
        .catch((err: Error) => {
          patch(id, { status: 'error' })
          toast.error(`${file.name}: ${err.message}`)
        })
        .finally(() => aborts.current.delete(id))
    }
  }, [])

  // Gắn lại tệp đã tải lên trước đó (kéo từ panel tài liệu / thẻ tệp): không tải lại
  const attach = useCallback((attachment: ChatAttachment) => {
    const current = filesRef.current
    if (current.some((f) => f.result?.key === attachment.key)) return
    if (current.length >= CHAT_MAX_ATTACHMENTS) return void toast.error(`Tối đa ${CHAT_MAX_ATTACHMENTS} tệp mỗi tin`)
    setFiles((list) => [
      ...list,
      {
        id: crypto.randomUUID(),
        name: attachment.name,
        size: attachment.size,
        previewUrl: attachment.kind === 'image' ? attachment.url : null,
        progress: 100,
        status: 'done',
        result: attachment
      }
    ])
  }, [])

  const remove = useCallback((id: string) => {
    aborts.current.get(id)?.()
    setFiles((list) => {
      const f = list.find((x) => x.id === id)
      if (f?.previewUrl) URL.revokeObjectURL(f.previewUrl)
      return list.filter((x) => x.id !== id)
    })
  }, [])

  // Sau khi gửi: tin lạc quan dùng URL R2 ⇒ thu hồi object URL xem trước
  const clear = useCallback(() => {
    for (const f of filesRef.current) if (f.previewUrl) URL.revokeObjectURL(f.previewUrl)
    setFiles([])
  }, [])

  return {
    files,
    add,
    attach,
    remove,
    clear,
    uploading: files.some((f) => f.status === 'uploading'),
    ready: files.filter((f) => f.status === 'done').map((f) => f.result!)
  }
}
