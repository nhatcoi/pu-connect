'use client'

import React from 'react'
import type { DocumentItem } from '@pu/schemas'
import {
  FileText,
  FileCode,
  FileSpreadsheet,
  Download,
  Eye,
  Share2
} from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store'

interface DocumentCardProps {
  document: DocumentItem
}

function getDocumentIcon(type: string) {
  switch (type) {
    case 'pdf':
      return <FileText className="h-6 w-6 text-red-500" />
    case 'code':
      return <FileCode className="h-6 w-6 text-blue-500" />
    case 'sheet':
      return <FileSpreadsheet className="h-6 w-6 text-green-500" />
    default:
      return <FileText className="h-6 w-6 text-primary" />
  }
}

function formatFileSize(bytes?: number | string): string {
  if (!bytes) return '1.2 MB'
  if (typeof bytes === 'string') return bytes
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentCard({ document: item }: DocumentCardProps) {
  const setPreviewDocument = useAppStore((state) => state.setPreviewDocument)

  const uploader = (item as any).uploader || item.owner
  const displayName = uploader?.displayName || uploader?.username || 'Thành viên Phenikaa'
  const faculty = (item as any).faculty || uploader?.faculty

  const rawTags = Array.isArray(item.tags) ? item.tags : []
  const courseCode = (item as any).courseCode
  const displayTags = rawTags.length > 0
    ? rawTags
    : [courseCode, faculty].filter(Boolean) as string[]

  return (
    <Card className="flex flex-col justify-between transition-all duration-200 hover:border-border/80 hover:shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
              {getDocumentIcon(item.type)}
            </div>
            <div>
              <h3 className="font-semibold text-sm line-clamp-1 leading-snug">{item.title}</h3>
              <p className="text-xs text-muted-foreground">
                Tải lên bởi <span className="font-medium text-foreground">{displayName}</span>
                {faculty && <span className="text-[11px] text-muted-foreground/80"> • {faculty}</span>}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
            {item.type}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pb-3">
        {item.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        )}

        {displayTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {displayTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[11px] font-normal">
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t">
          <span>Kích thước: {formatFileSize(item.fileSize)}</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" /> {item.viewCount || 0}
            </span>
            <span className="flex items-center gap-1">
              <Download className="h-3 w-3" /> {item.downloadCount || 0}
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between border-t bg-muted/20 py-2.5">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => setPreviewDocument(item)}
        >
          <Eye className="h-3.5 w-3.5" />
          <span>Xem trước</span>
        </Button>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
            <Share2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="default"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => {
              const a = window.document.createElement('a')
              a.href = item.fileUrl
              a.download = item.title
              a.click()
            }}
          >
            <Download className="h-3.5 w-3.5" />
            <span>Tải về</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
