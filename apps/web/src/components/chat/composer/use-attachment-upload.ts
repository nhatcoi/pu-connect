'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CHAT_MAX_ATTACHMENTS, type ChatAttachment } from '@pu/schemas'
import { API_BASE_URL } from '@/lib/api-client'

const MAX_BYTES = 25 * 1024 * 1024

export type PendingFile = {
  id: string
  file: File
  previewUrl: string | null // ảnh: object URL để xem trước
  progress: number // 0–100
  status: 'uploading' | 'done' | 'error'
  result?: ChatAttachment
}

// Tải 1 tệp lên R2 (thư mục chat/) qua XHR để có tiến trình
function uploadWithProgress(file: File, onProgress: (p: number) => void): { promise: Promise<ChatAttachment>; abort: () => void } {
  const xhr = new XMLHttpRequest()
  const promise = new Promise<ChatAttachment>((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)
    xhr.open('POST', `${API_BASE_URL}/upload/file?folder=chat`)
    xhr.withCredentials = true
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText)
        if (xhr.status >= 300) return reject(new Error(body?.message || 'Tải tệp thất bại'))
        const d = body.data
        resolve({
          url: d.url,
          key: d.key,
          size: d.size,
          name: file.name,
          mime: file.type || 'application/octet-stream',
          kind: file.type.startsWith('image/') ? 'image' : 'file'
        })
      } catch {
        reject(new Error('Tải tệp thất bại'))
      }
    }
    xhr.onerror = () => reject(new Error('Mất kết nối khi tải tệp'))
    xhr.send(form)
  })
  return { promise, abort: () => xhr.abort() }
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
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name} lớn hơn 25 MB`)
        continue
      }
      const id = crypto.randomUUID()
      const item: PendingFile = {
        id,
        file,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        progress: 0,
        status: 'uploading'
      }
      setFiles((list) => [...list, item])
      const { promise, abort } = uploadWithProgress(file, (progress) => patch(id, { progress }))
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
    remove,
    clear,
    uploading: files.some((f) => f.status === 'uploading'),
    ready: files.filter((f) => f.status === 'done').map((f) => f.result!)
  }
}
