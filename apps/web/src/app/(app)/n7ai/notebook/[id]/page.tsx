'use client'

import React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { NoteView } from '@/components/n7ai/side-panel/panel-notes'
import { useAiNotes } from '@/hooks/chat/use-ai-notes'

// /n7ai/notebook/[id]: sửa một trang chiếm hết chiều rộng — cùng logic tự lưu / ⋯ menu với panel Ghi chú cạnh chat (NoteView dùng chung)
export default function NotebookPagePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { notes, isPending } = useAiNotes()

  if (isPending) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }
  if (!notes.some((n) => n.id === id)) {
    router.replace('/n7ai/notebook')
    return null
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <NoteView key={id} id={id} notes={notes} onToggleTree={() => router.push('/n7ai/notebook')} onGone={() => router.replace('/n7ai/notebook')} />
    </div>
  )
}
