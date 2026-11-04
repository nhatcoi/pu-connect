'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { AttachedDocument } from '@pu/schemas'
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

function DocumentPaperMockup({ title, ext, colorClass }: { title: string; ext: string; colorClass?: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted/40 p-2.5">
      <div className="relative flex h-full w-[84%] max-w-[220px] flex-col overflow-hidden rounded-md border border-border/80 bg-background shadow-xs">
        <div className={cn('h-1 w-full', colorClass ?? 'bg-primary')} />
        <div className="flex flex-1 flex-col p-2.5">
          <div className="mb-2 flex items-center justify-between border-b border-border/40 pb-1.5">
            <span className={cn('rounded px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider', colorClass ? `${colorClass} text-white` : 'bg-primary/10 text-primary')}>
              {ext}
            </span>
            <div className="flex gap-1">
              <span className="h-1.5 w-4 rounded-full bg-muted" />
              <span className="h-1.5 w-2 rounded-full bg-muted" />
            </div>
          </div>
          <p className="line-clamp-2 text-[10px] font-bold leading-tight text-foreground/90">{title}</p>
          <div className="mt-2.5 space-y-1.5">
            <div className="h-1.5 w-full rounded-sm bg-muted/80" />
            <div className="h-1.5 w-[85%] rounded-sm bg-muted/70" />
            <div className="h-1.5 w-[92%] rounded-sm bg-muted/60" />
            <div className="h-1.5 w-[65%] rounded-sm bg-muted/50" />
          </div>
          <div className="mt-auto flex items-center justify-between border-t border-border/30 pt-2 text-[8px] text-muted-foreground/60">
            <span>Trang 1</span>
            <span className="font-mono">PUC</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SpreadsheetMockup({ title }: { title: string }) {
  return (
    <div className="flex h-full w-full flex-col bg-background p-2">
      <div className="flex items-center gap-1.5 rounded-t bg-emerald-600 px-2 py-1 text-white">
        <span className="text-[9px] font-bold tracking-wider">XLSX</span>
        <span className="truncate text-[9px] font-medium opacity-90">{title}</span>
      </div>
      <div className="flex items-center gap-2 border-x border-border/60 bg-muted/30 px-2 py-0.5 text-[8px] text-muted-foreground">
        <span className="font-serif italic font-bold">fx</span>
        <span className="h-2 flex-1 rounded bg-muted/60" />
      </div>
      <div className="grid flex-1 grid-cols-4 divide-x divide-y divide-border/60 border border-border/60 bg-background text-[8px]">
        <div className="bg-muted/50 text-center font-bold text-muted-foreground">A</div>
        <div className="bg-muted/50 text-center font-bold text-muted-foreground">B</div>
        <div className="bg-muted/50 text-center font-bold text-muted-foreground">C</div>
        <div className="bg-muted/50 text-center font-bold text-muted-foreground">D</div>
        <div className="p-1"><span className="block h-1.5 w-full rounded-xs bg-muted/70" /></div>
        <div className="p-1"><span className="block h-1.5 w-3/4 rounded-xs bg-muted/60" /></div>
        <div className="p-1"><span className="block h-1.5 w-full rounded-xs bg-muted/70" /></div>
        <div className="p-1"><span className="block h-1.5 w-1/2 rounded-xs bg-muted/50" /></div>
        <div className="p-1"><span className="block h-1.5 w-4/5 rounded-xs bg-muted/60" /></div>
        <div className="p-1"><span className="block h-1.5 w-full rounded-xs bg-muted/70" /></div>
        <div className="p-1"><span className="block h-1.5 w-2/3 rounded-xs bg-muted/60" /></div>
        <div className="p-1"><span className="block h-1.5 w-full rounded-xs bg-muted/70" /></div>
      </div>
    </div>
  )
}

function CodeMockup({ title, ext }: { title: string; ext: string }) {
  return (
    <div className="flex h-full w-full flex-col bg-[#1e1e2e] p-2 text-white/90">
      <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
        <div className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-[#f38ba8]" />
          <span className="h-2 w-2 rounded-full bg-[#f9e2af]" />
          <span className="h-2 w-2 rounded-full bg-[#a6e3a1]" />
        </div>
        <span className="max-w-[130px] truncate font-mono text-[9px] text-white/60">{title}</span>
        <span className="rounded bg-white/10 px-1 py-0.5 font-mono text-[8px] uppercase text-[#89b4fa]">{ext}</span>
      </div>
      <div className="flex flex-1 gap-2 pt-2 font-mono text-[9px] leading-relaxed">
        <div className="space-y-1 select-none text-[8px] text-white/30">
          <div>1</div>
          <div>2</div>
          <div>3</div>
          <div>4</div>
        </div>
        <div className="flex-1 space-y-1 pt-0.5">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-8 rounded bg-[#cba6f7]" />
            <span className="h-1.5 w-14 rounded bg-[#89b4fa]" />
          </div>
          <div className="flex items-center gap-1.5 pl-3">
            <span className="h-1.5 w-12 rounded bg-[#a6e3a1]" />
            <span className="h-1.5 w-16 rounded bg-white/40" />
          </div>
          <div className="flex items-center gap-1.5 pl-3">
            <span className="h-1.5 w-20 rounded bg-[#f9e2af]" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-6 rounded bg-[#89dceb]" />
          </div>
        </div>
      </div>
    </div>
  )
}

// Ảnh bìa tài liệu: PDF ⇒ trang đầu bằng pdfjs, DOCX ⇒ trang đầu docx-preview, Ảnh ⇒ hiển thị trực tiếp, Tệp khác ⇒ mô phỏng trực quan
export function DocumentThumbnail({ document: doc, className }: { document: Pick<AttachedDocument, 'fileUrl' | 'title' | 'mimeType'>; className?: string }) {
  const isPdf = doc.mimeType === 'application/pdf' || /\.pdf($|\?)/i.test(doc.fileUrl)
  const isImage = doc.mimeType?.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)($|\?)/i.test(doc.fileUrl)
  const isDocx = doc.mimeType?.includes('wordprocessingml') || /\.docx($|\?)/i.test(doc.fileUrl)
  const isSheet = doc.mimeType?.includes('spreadsheet') || /\.(xlsx|xls|csv)($|\?)/i.test(doc.fileUrl)
  const isCode = /\.(py|js|ts|tsx|jsx|json|html|css|cpp|java|c|rs|go|sh|sql)($|\?)/i.test(doc.fileUrl)

  const holder = useRef<HTMLDivElement>(null)
  const docxHostRef = useRef<HTMLDivElement>(null)
  const [src, setSrc] = useState<string | null>(cache.get(doc.fileUrl) ?? null)
  const [docxRendered, setDocxRendered] = useState(false)

  // Render PDF trang đầu
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

  // Render DOCX trang đầu qua docx-preview
  useEffect(() => {
    const el = holder.current
    if (!isDocx || !el) return
    let cancelled = false
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        void enqueue(async () => {
          try {
            const res = await fetch(fileSourceUrl(doc.fileUrl), { credentials: 'include' })
            if (!res.ok) return
            const buf = await res.arrayBuffer()
            if (cancelled || !docxHostRef.current) return
            const { renderAsync } = await import('docx-preview')
            if (docxHostRef.current && !cancelled) {
              docxHostRef.current.replaceChildren()
              await renderAsync(buf, docxHostRef.current, undefined, {
                className: 'docx',
                inWrapper: true,
                breakPages: true,
                ignoreLastRenderedPageBreak: true
              })
              if (!cancelled) setDocxRendered(true)
            }
          } catch {
            // Giữ mockup giấy fallback
          }
        })
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [doc.fileUrl, isDocx])

  const ext = docExt(doc)
  const colorClass = isDocx ? 'bg-blue-600' : isPdf ? 'bg-red-600' : ext === 'PPTX' ? 'bg-amber-600' : undefined

  return (
    <div ref={holder} className={cn('relative overflow-hidden bg-muted', className)}>
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fileSourceUrl(doc.fileUrl)} alt={doc.title} className="h-full w-full object-cover object-top" draggable={false} />
      ) : src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={doc.title} className="h-full w-full object-cover object-top" draggable={false} />
      ) : isDocx ? (
        <div className="relative h-full w-full overflow-hidden bg-white">
          <div
            ref={docxHostRef}
            className={cn(
              'pointer-events-none absolute left-1/2 top-0 origin-top -translate-x-1/2 scale-[0.32] w-[794px] select-none bg-white transition-opacity duration-300',
              docxRendered ? 'opacity-100 z-10' : 'opacity-0 -z-10',
              '[&_.docx-wrapper]:bg-white! [&_.docx-wrapper]:p-4! [&_.docx-wrapper>section.docx]:mb-0! [&_.docx-wrapper>section.docx]:shadow-none! [&_.docx-wrapper>section.docx~section]:hidden!'
            )}
          />
          {!docxRendered && <DocumentPaperMockup title={doc.title} ext={ext} colorClass={colorClass} />}
        </div>
      ) : isSheet ? (
        <SpreadsheetMockup title={doc.title} />
      ) : isCode ? (
        <CodeMockup title={doc.title} ext={ext} />
      ) : (
        <DocumentPaperMockup title={doc.title} ext={ext} colorClass={colorClass} />
      )}
    </div>
  )
}
