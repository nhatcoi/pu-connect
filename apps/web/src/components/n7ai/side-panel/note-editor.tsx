'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

// Dynamic import BlockNote Editor với ssr: false như DeepTutor để tránh lỗi hydration và DOM mismatch
const BlockNoteEditor = dynamic(
  () => import('../editor/blocknote-editor').then((m) => m.BlockNoteEditorComponent),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary opacity-60" />
      </div>
    )
  }
)

export function NoteEditor({
  initial,
  onChange,
  appendRef,
  noteId,
  mode = 'panel'
}: {
  initial: string
  onChange: (markdown: string) => void
  appendRef?: React.MutableRefObject<((markdown: string) => void) | null>
  noteId: string
  mode?: 'panel' | 'fullscreen'
}) {
  return (
    <BlockNoteEditor
      initialMarkdown={initial}
      onChange={onChange}
      appendRef={appendRef}
      noteId={noteId}
    />
  )
}
