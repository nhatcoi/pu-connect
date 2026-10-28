'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import type { AiSource, ChatAttachment } from '@pu/schemas'
import { sourceError, uploadChatFile } from '@/components/chat/composer/attachment-files'
import { useAiSources } from '@/hooks/chat'

export interface UploadingFile {
  id: string
  name: string
  progress: number
}

const toFileInput = (a: Pick<ChatAttachment, 'key' | 'name' | 'size' | 'mime'>) => ({ type: 'file' as const, file: { key: a.key, name: a.name, size: a.size, mime: a.mime } })

// Thêm tài liệu vào 1 cuộc trò chuyện (threadId) hoặc thư viện (bỏ trống): tải tệp lên R2 rồi đăng ký, kèm tiến trình
export function useAddSources(threadId?: string) {
  const { sources, isPending, add, addCollection, saveToLibrary, remove, setInContext } = useAiSources(threadId)
  const [uploading, setUploading] = useState<UploadingFile[]>([])
  const { mutateAsync } = add

  const addFiles = useCallback(
    async (files: File[]) => {
      const valid = files.filter((file) => {
        const error = sourceError(file)
        if (error) toast.error(error)
        return !error
      })
      await Promise.all(
        valid.map(async (file) => {
          const id = crypto.randomUUID()
          setUploading((list) => [...list, { id, name: file.name, progress: 0 }])
          try {
            const uploaded = await uploadChatFile(file, (progress) => setUploading((list) => list.map((u) => (u.id === id ? { ...u, progress } : u)))).promise
            await mutateAsync(toFileInput(uploaded)).catch(() => undefined) // lỗi đã báo toast trong hook
          } catch (err) {
            toast.error(`${file.name}: ${(err as Error).message}`)
          } finally {
            setUploading((list) => list.filter((u) => u.id !== id))
          }
        })
      )
    },
    [mutateAsync]
  )

  // Tệp đã tải lên trước đó (kéo từ tin nhắn / thư viện)
  const addAttachment = useCallback((a: ChatAttachment) => void mutateAsync(toFileInput(a)).catch(() => undefined), [mutateAsync])
  const addText = useCallback((title: string, content: string) => mutateAsync({ type: 'text', title: title || undefined, content }), [mutateAsync])
  const addLink = useCallback((url: string) => mutateAsync({ type: 'link', url }), [mutateAsync])
  const addDocument = useCallback((documentId: string) => mutateAsync({ type: 'document', documentId }), [mutateAsync])
  const addCollectionById = addCollection.mutateAsync
  const copyFrom = useCallback((source: AiSource) => (threadId ? mutateAsync({ type: 'copy', threadId, sourceId: source.id }) : Promise.resolve(source)), [mutateAsync, threadId])

  return { sources, isPending, uploading, adding: add.isPending, addFiles, addAttachment, addText, addLink, addDocument, addCollection: addCollectionById, copyFrom, saveToLibrary: saveToLibrary.mutate, remove: remove.mutate, setInContext: setInContext.mutate }
}

export type SourceAdder = ReturnType<typeof useAddSources>
