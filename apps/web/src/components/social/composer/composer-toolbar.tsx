'use client'

import React, { useRef } from 'react'
import {
  Image as ImageIcon,
  FileText,
  Binary,
  Code2,
  GitBranch,
  Eye,
  EyeOff,
  Hash
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ComposerToolbarProps {
  onInsertText: (text: string) => void
  onAddFiles: (files: FileList) => void
  onToggleTagInput: () => void
  isPreviewMode: boolean
  onTogglePreview: () => void
  showTagInput: boolean
}

export function ComposerToolbar({
  onInsertText,
  onAddFiles,
  onToggleTagInput,
  isPreviewMode,
  onTogglePreview,
  showTagInput
}: ComposerToolbarProps) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)

  const handleImageClick = () => {
    imageInputRef.current?.click()
  }

  const handleDocClick = () => {
    docInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(e.target.files)
      e.target.value = ''
    }
  }

  const handleInsertMath = () => {
    onInsertText(' $f(x) = \\int_{0}^{\\infty} e^{-x^2} dx$ ')
  }

  const handleInsertCode = () => {
    onInsertText('\n```python\n# Mã nguồn bài tập\ndef solve():\n    pass\n```\n')
  }

  const handleInsertMermaid = () => {
    onInsertText('\n```mermaid\ngraph TD\n    A[Bắt đầu] --> B[Xử lý]\n    B --> C[Kết thúc]\n```\n')
  }

  return (
    <div className="flex items-center gap-0.5 text-primary">
      {/* Hidden File Inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.rar"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Action Icons */}
      <button
        type="button"
        onClick={handleImageClick}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
        title="Đính kèm ảnh bài tập / sơ đồ"
      >
        <ImageIcon className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={handleDocClick}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
        title="Tải lên tài liệu, slide, đề thi PDF"
      >
        <FileText className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={handleInsertMath}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer font-serif font-bold text-xs"
        title="Chèn công thức toán học LaTeX ($KaTeX$)"
      >
        <Binary className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={handleInsertCode}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
        title="Chèn khối mã nguồn (Code Block)"
      >
        <Code2 className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={handleInsertMermaid}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
        title="Chèn sơ đồ thuật toán (Mermaid Diagram)"
      >
        <GitBranch className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onToggleTagInput}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full transition-colors cursor-pointer',
          showTagInput
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
        )}
        title="Gắn thẻ chủ đề (#hashtag)"
      >
        <Hash className="h-4 w-4" />
      </button>

      {/* Preview Toggle */}
      <button
        type="button"
        onClick={onTogglePreview}
        className={cn(
          'flex h-8 items-center gap-1 px-2.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ml-1',
          isPreviewMode
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
        )}
        title="Xem trước kết quả định dạng"
      >
        {isPreviewMode ? (
          <>
            <EyeOff className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Soạn thảo</span>
          </>
        ) : (
          <>
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Xem trước</span>
          </>
        )}
      </button>
    </div>
  )
}
