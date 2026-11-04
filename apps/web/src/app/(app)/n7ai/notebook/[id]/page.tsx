'use client'

import React, { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { NoteView } from '@/components/n7ai/side-panel/panel-notes'
import { useAiNote, useAiNotes } from '@/hooks/chat/use-ai-notes'

// /n7ai/notebook/[id]: sửa một trang chiếm hết chiều rộng — cùng logic tự lưu / ⋯ menu với panel Ghi chú cạnh chat (NoteView dùng chung)
export default function NotebookPagePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { notes, isPending: notesPending } = useAiNotes()
  const { data: note, isPending: notePending, error } = useAiNote(id)

  const isPending = notesPending && notePending

  // Cập nhật title của document trên tab trình duyệt
  useEffect(() => {
    if (note?.title) {
      document.title = `${note.title} · Notebook | N7AI`
    } else {
      document.title = 'Notebook | N7AI'
    }
  }, [note?.title])

  if (isPending) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  // Nếu đã tải xong nhưng không tìm thấy ghi chú
  if (error || (!notesPending && !notePending && !note && !notes.some((n) => n.id === id))) {
    router.replace('/n7ai/notebook')
    return null
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <NoteView
        key={id}
        id={id}
        notes={notes}
        mode="fullscreen"
        onToggleTree={() => router.push('/n7ai/notebook')}
        onGone={() => router.replace('/n7ai/notebook')}
      />
    </div>
  )
}
