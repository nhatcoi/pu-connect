'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PdfViewer } from './pdf-viewer'
import { MarkdownPreview } from '@/components/renderer/markdown-preview'
import type { DocumentItem } from '@pu/schemas'
import { Eye } from 'lucide-react'

const PptxView = dynamic(() => import('./views/pptx-view'), {
  ssr: false,
  loading: () => <div className="p-8 text-center text-xs text-muted-foreground">Đang tải trình xem slide…</div>
})

interface DocumentPreviewModalProps {
  document: DocumentItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DocumentPreviewModal({ document, open, onOpenChange }: DocumentPreviewModalProps) {
  if (!document) return null

  const isPdf = document.type === 'pdf'
  const isMarkdown = document.type === 'markdown'
  const isPptx = document.type === 'slides' || (Boolean(document.fileUrl) && /\.pptx($|\?)/i.test(document.fileUrl))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-4 sm:p-6">
        <DialogHeader className="pb-2 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground truncate">
            <Eye className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">{document.title}</span>
          </DialogTitle>
          {document.description && <p className="text-xs text-muted-foreground mt-0.5">{document.description}</p>}
        </DialogHeader>

        <div className="py-2">
          {isPdf ? (
            <PdfViewer url={document.fileUrl} title={document.title} />
          ) : isPptx ? (
            <div className="h-[75vh] w-full overflow-hidden rounded-lg border border-border bg-card">
              <PptxView url={document.fileUrl} name={document.title} />
            </div>
          ) : isMarkdown ? (
            <div className="max-h-[65vh] overflow-y-auto rounded-lg border border-border bg-card p-4">
              <MarkdownPreview content={`# ${document.title}\n\n${document.description || ''}\n\n\`\`\`json\n${JSON.stringify(document, null, 2)}\n\`\`\``} />
            </div>
          ) : (
            <div className="max-h-[65vh] overflow-y-auto rounded-lg border border-border bg-card p-4">
              <MarkdownPreview content={`# ${document.title}\n\n*Định dạng: ${document.type}*\n\n\`\`\`text\n${document.fileUrl}\n\`\`\``} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
