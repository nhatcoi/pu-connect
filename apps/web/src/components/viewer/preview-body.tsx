'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import { FileQuestion } from 'lucide-react'
import { previewKind, type PreviewFile } from './file-kind'
import { OfficeEmbed } from './views/office-embed'
import { ViewerLoading } from './views/viewer-parts'

// Mỗi trình xem là một chunk riêng, chỉ tải khi mở loại tệp đó (pdf.js, docx-preview… khá nặng)
const loading = () => <ViewerLoading />

const PdfView = dynamic(() => import('./views/pdf-view'), { ssr: false, loading })
const DocxView = dynamic(() => import('./views/docx-view'), { ssr: false, loading })
const PptxView = dynamic(() => import('./views/pptx-view'), { ssr: false, loading })
const SheetView = dynamic(() => import('./views/sheet-view'), { ssr: false, loading })
const ImageView = dynamic(() => import('./views/image-view'), { ssr: false, loading })
const MarkdownView = dynamic(() => import('./views/text-view').then((m) => m.MarkdownView), { ssr: false, loading })
const CodeView = dynamic(() => import('./views/text-view').then((m) => m.CodeView), { ssr: false, loading })
const CsvView = dynamic(() => import('./views/text-view').then((m) => m.CsvView), { ssr: false, loading })

function Unsupported({ file }: { file: PreviewFile }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
      <FileQuestion className="h-10 w-10 opacity-40" />
      <p className="text-sm">Chưa xem trước được định dạng này.</p>
      <a href={file.url} download={file.name} className="text-sm font-medium text-primary hover:underline">
        Tải về để mở
      </a>
    </div>
  )
}

// Chọn trình xem theo loại tệp
export function PreviewBody({ file }: { file: PreviewFile }) {
  const { url, name } = file
  switch (previewKind(file)) {
    case 'pdf':
      return <PdfView url={url} />
    case 'docx':
      return <DocxView url={url} />
    case 'pptx':
      return <PptxView url={url} name={name} />
    case 'sheet':
      return <SheetView url={url} />
    case 'csv':
      return <CsvView url={url} name={name} />
    case 'markdown':
      return <MarkdownView url={url} />
    case 'code':
      return <CodeView url={url} name={name} />
    case 'image':
      return <ImageView url={url} name={name} />
    case 'video':
      return (
        <div className="flex h-full items-center justify-center bg-muted/50 p-4">
          <video src={url} controls className="max-h-full max-w-full rounded-xl bg-black shadow-sm" />
        </div>
      )
    case 'audio':
      return (
        <div className="flex h-full items-center justify-center bg-muted/50 p-4">
          <audio src={url} controls className="w-full max-w-md" />
        </div>
      )
    case 'office':
      return <OfficeEmbed url={url} name={name} />
    default:
      return <Unsupported file={file} />
  }
}
