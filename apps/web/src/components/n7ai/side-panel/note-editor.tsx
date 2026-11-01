'use client'

import React from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Link } from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { Markdown } from '@tiptap/markdown'
import { Bold, Code, Heading1, Heading2, Italic, List, ListOrdered, Quote, Table as TableIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// Trình soạn Markdown của ghi chú N7AI (tiptap): nội dung ban đầu cố định theo ghi chú (key = id), mọi thay đổi trả về Markdown
export function NoteEditor({ initial, onChange, appendRef }: { initial: string; onChange: (markdown: string) => void; appendRef?: React.MutableRefObject<((markdown: string) => void) | null> }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: 'Viết ghi chú bằng Markdown…' }),
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Markdown
    ],
    content: initial,
    contentType: 'markdown',
    editorProps: { attributes: { class: 'markdown-body min-h-[50vh] px-1 pb-24 text-[15px] leading-7 text-foreground focus:outline-none' } },
    onUpdate: ({ editor }) => onChange(editor.getMarkdown())
  })

  React.useEffect(() => {
    if (!appendRef || !editor) return
    appendRef.current = (md) => editor.chain().focus('end').insertContentAt(editor.state.doc.content.size, md, { contentType: 'markdown' }).run()
    return () => {
      appendRef.current = null
    }
  }, [editor, appendRef])

  if (!editor) return null
  const tools: { label: string; icon: typeof Bold; active: boolean; run: () => void }[] = [
    { label: 'Đậm', icon: Bold, active: editor.isActive('bold'), run: () => editor.chain().focus().toggleBold().run() },
    { label: 'Nghiêng', icon: Italic, active: editor.isActive('italic'), run: () => editor.chain().focus().toggleItalic().run() },
    { label: 'Tiêu đề 1', icon: Heading1, active: editor.isActive('heading', { level: 1 }), run: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: 'Tiêu đề 2', icon: Heading2, active: editor.isActive('heading', { level: 2 }), run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: 'Danh sách', icon: List, active: editor.isActive('bulletList'), run: () => editor.chain().focus().toggleBulletList().run() },
    { label: 'Danh sách số', icon: ListOrdered, active: editor.isActive('orderedList'), run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: 'Trích dẫn', icon: Quote, active: editor.isActive('blockquote'), run: () => editor.chain().focus().toggleBlockquote().run() },
    { label: 'Khối mã', icon: Code, active: editor.isActive('codeBlock'), run: () => editor.chain().focus().toggleCodeBlock().run() },
    { label: 'Bảng', icon: TableIcon, active: false, run: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() }
  ]
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-border/60 px-3 py-1.5" role="toolbar" aria-label="Định dạng ghi chú">
        {tools.map(({ label, icon: Icon, active, run }) => (
          <button
            key={label}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            onMouseDown={(e) => e.preventDefault()}
            onClick={run}
            className={cn(
              'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              active && 'bg-muted text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
