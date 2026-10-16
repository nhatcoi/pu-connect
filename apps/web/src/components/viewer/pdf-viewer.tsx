'use client'

import React, { useState } from 'react'
import { FileText, Download, ZoomIn, ZoomOut, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PdfViewerProps {
  url: string
  title: string
}

export function PdfViewer({ url, title }: PdfViewerProps) {
  const [zoom, setZoom] = useState(100)
  const [isLoading, setIsLoading] = useState(false)

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 20, 200))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 20, 60))

  return (
    <div className="flex flex-col h-[70vh] rounded-lg border border-border bg-muted/20 overflow-hidden">
      {/* PDF Controls Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2 text-xs">
        <div className="flex items-center gap-2 font-medium text-foreground truncate max-w-md">
          <FileText className="h-4 w-4 text-red-500 shrink-0" />
          <span className="truncate">{title}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={handleZoomOut} className="h-7 w-7 p-0">
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-[11px] font-mono w-10 text-center text-muted-foreground">{zoom}%</span>
          <Button variant="ghost" size="sm" onClick={handleZoomIn} className="h-7 w-7 p-0">
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>

          <div className="mx-1.5 h-4 w-px bg-border" />

          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => window.open(url, '_blank')}>
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Mở tab mới</span>
          </Button>

          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs bg-primary text-primary-foreground"
            onClick={() => {
              const a = document.createElement('a')
              a.href = url
              a.download = title
              a.click()
            }}
          >
            <Download className="h-3.5 w-3.5" />
            <span>Tải về</span>
          </Button>
        </div>
      </div>

      {/* PDF Frame Viewer */}
      <div className="flex-1 bg-muted/40 p-2 overflow-auto flex items-center justify-center relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        <iframe
          src={`${url}#toolbar=0&navpanes=0`}
          className="w-full h-full rounded shadow-xs bg-white border border-border"
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          onLoad={() => setIsLoading(false)}
          title={title}
        />
      </div>
    </div>
  )
}
