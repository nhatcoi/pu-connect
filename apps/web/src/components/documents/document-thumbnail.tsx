'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { AttachedDocument } from '@pu/schemas'
import { FileText } from 'lucide-react'
import { fileSourceUrl } from '@/components/viewer/use-file-bytes'
import { cn } from '@/lib/utils'
import { docExt } from './document-format'

const THUMB_WIDTH = 360
const MAX_CACHED = 80
const MAX_PARALLEL = 2

// Ảnh trang đầu đã vẽ (dataURL), null = không vẽ được ⇒ dùng ô biểu tượng
const cache = new Map<string, string | null>()
let running = 0
const waiting: Array<() => void> = []

// Hàng đợi: tối đa 2 PDF vẽ cùng lúc để kệ dài không làm đơ trang
async function enqueue<T>(task: () => Promise<T>): Promise<T> {
  if (running >= MAX_PARALLEL) await new Promise<void>((resolve) => waiting.push(resolve))
  running++
  try {
    return await task()
  } finally {
    running--
    waiting.shift()?.()
  }
}

async function renderFirstPage(url: string): Promise<string | null> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  const task = pdfjs.getDocument({ url: fileSourceUrl(url), withCredentials: true })
  try {
    const pdf = await task.promise
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: THUMB_WIDTH / page.getViewport({ scale: 1 }).width })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    await page.render({ canvas, viewport }).promise
    return canvas.toDataURL('image/jpeg', 0.72)
  } catch {
    return null
  } finally {
    void task.destroy()
  }
}

function remember(url: string, value: string | null) {
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value as string)
  cache.set(url, value)
}

// Ảnh bìa tài liệu: PDF ⇒ trang đầu (vẽ khi cuộn tới), tệp khác ⇒ ô biểu tượng theo định dạng
export function DocumentThumbnail({ document: doc, className }: { document: Pick<AttachedDocument, 'fileUrl' | 'title' | 'mimeType'>; className?: string }) {
  const isPdf = doc.mimeType === 'application/pdf' || /\.pdf($|\?)/i.test(doc.fileUrl)
  const holder = useRef<HTMLDivElement>(null)
  const [src, setSrc] = useState<string | null>(cache.get(doc.fileUrl) ?? null)

  useEffect(() => {
    const el = holder.current
    if (!isPdf || !el || cache.has(doc.fileUrl)) return
    let cancelled = false
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        void enqueue(() => renderFirstPage(doc.fileUrl)).then((url) => {
          remember(doc.fileUrl, url)
          if (!cancelled) setSrc(url)
        })
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [doc.fileUrl, isPdf])

  return (
    <div ref={holder} className={cn('relative overflow-hidden bg-muted', className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- dataURL tự vẽ, không qua tối ưu ảnh
        <img src={src} alt={doc.title} className="h-full w-full object-cover object-top" draggable={false} />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-primary/10 to-primary/5 text-primary">
          <FileText className="h-7 w-7 opacity-70" />
          <span className="text-[10px] font-bold tracking-wide">{docExt(doc)}</span>
        </div>
      )}
    </div>
  )
}
