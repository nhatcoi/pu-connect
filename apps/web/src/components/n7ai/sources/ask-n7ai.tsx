'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { chatApi } from '@/hooks/chat/api'
import { errorMessage } from '@/lib/api-client'
import { n7aiThreadHref } from '@/lib/n7ai-routes'
import { queryKeys } from '@/lib/query-keys'
import { useAppStore } from '@/store'

export type AskTarget = { type: 'document'; documentId: string } | { type: 'collection'; collectionId: string }

// Mở cuộc trò chuyện N7AI mới đã có sẵn tài liệu (một tài liệu hoặc cả bộ sưu tập) để hỏi / quiz / tóm tắt
export function AskN7aiButton({ target, label = 'Hỏi N7AI' }: { target: AskTarget; label?: string }) {
  const user = useAppStore((s) => s.user)
  const router = useRouter()
  const qc = useQueryClient()
  const [pending, setPending] = useState(false)
  if (!user) return null

  const ask = async () => {
    setPending(true)
    try {
      const thread = await chatApi.createAiThread()
      qc.setQueryData(queryKeys.conversation(thread.id), thread)
      if (target.type === 'document') await chatApi.addAiSource({ type: 'document', threadId: thread.id, documentId: target.documentId })
      else {
        const { added } = await chatApi.addAiSourceCollection({ threadId: thread.id, collectionId: target.collectionId })
        if (!added) throw new Error('Bộ này chưa có tài liệu nào N7AI đọc được')
      }
      await qc.invalidateQueries({ queryKey: queryKeys.aiSources(thread.id) })
      router.push(n7aiThreadHref(thread.id))
    } catch (err) {
      toast.error(errorMessage(err, 'Không mở được N7AI'))
      setPending(false)
    }
  }

  return (
    <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full text-xs" disabled={pending} onClick={() => void ask()}>
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-primary" />} {label}
    </Button>
  )
}

// Gợi ý từ bộ sưu tập: thêm bộ vào cuộc trò chuyện hiện tại trước khi điền / gửi câu hỏi
export async function attachSuggestionCollection(qc: ReturnType<typeof useQueryClient>, threadId: string, collection: { id: string; title: string } | undefined) {
  if (!collection) return
  try {
    await chatApi.addAiSourceCollection({ threadId, collectionId: collection.id })
    await qc.invalidateQueries({ queryKey: queryKeys.aiSources(threadId) })
  } catch (err) {
    toast.error(errorMessage(err, `Không thêm được bộ “${collection.title}”`))
  }
}
