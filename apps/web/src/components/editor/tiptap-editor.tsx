'use client'

import React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Link } from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { Bold, Italic, List, ListOrdered, Quote, Code, Heading1, Heading2, Table as TableIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TiptapEditorProps {
  content?: string
  onChange?: (html: string) => void
  placeholder?: string
  className?: string
}

export function TiptapEditor({ content = '', onChange, placeholder = 'Nhập nội dung bài viết...', className }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Placeholder.configure({
        placeholder
      }),
      Link.configure({
        openOnClick: false
      }),
      Table.configure({
        resizable: true
      }),
      TableRow,
      TableHeader,
      TableCell
    ],
    content,
    editorProps: {
      attributes: {
        class: 'min-h-[140px] w-full rounded-b-md px-3 py-2.5 text-sm text-foreground bg-background focus:outline-none'
      }
    },
    onUpdate({ editor }) {
      onChange?.(editor.getHTML())
    }
  })

  if (!editor) {
    return null
  }

  return (
    <div className={cn('rounded-lg border border-border bg-background shadow-xs overflow-hidden', className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/50 p-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn('h-8 w-8 p-0 text-foreground hover:bg-muted', editor.isActive('bold') && 'bg-accent text-accent-foreground font-bold')}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn('h-8 w-8 p-0 text-foreground hover:bg-muted', editor.isActive('italic') && 'bg-accent text-accent-foreground')}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-4 w-px bg-border" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={cn('h-8 w-8 p-0 text-foreground hover:bg-muted', editor.isActive('heading', { level: 1 }) && 'bg-accent text-accent-foreground font-bold')}
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn('h-8 w-8 p-0 text-foreground hover:bg-muted', editor.isActive('heading', { level: 2 }) && 'bg-accent text-accent-foreground font-bold')}
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-4 w-px bg-border" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn('h-8 w-8 p-0 text-foreground hover:bg-muted', editor.isActive('bulletList') && 'bg-accent text-accent-foreground')}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn('h-8 w-8 p-0 text-foreground hover:bg-muted', editor.isActive('orderedList') && 'bg-accent text-accent-foreground')}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={cn('h-8 w-8 p-0 text-foreground hover:bg-muted', editor.isActive('blockquote') && 'bg-accent text-accent-foreground')}
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={cn('h-8 w-8 p-0 text-foreground hover:bg-muted', editor.isActive('codeBlock') && 'bg-accent text-accent-foreground font-bold')}
        >
          <Code className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          className="h-8 w-8 p-0 text-foreground hover:bg-muted"
        >
          <TableIcon className="h-4 w-4" />
        </Button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
