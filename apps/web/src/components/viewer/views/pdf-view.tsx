'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import 'pdfjs-dist/web/pdf_viewer.css'
import { cn } from '@/lib/utils'
import { fileSourceUrl } from '../use-file-bytes'
import { barButton, FloatingBar, Stage, useElementWidth, ViewerError, ViewerLoading, ZoomControls } from './viewer-parts'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

const GUTTER = 16 // lề hai bên + khoảng cách giữa các trang (px)
const MAX_DPR = 2

type PageSize = { width: number; height: number }

// Một trang: giữ chỗ đúng kích thước, chỉ vẽ khi gần màn hình và giải phóng khi đã cuộn xa
function PdfPage({
  doc,
  index,
  scale,
  size,
  onActive
}: {
  doc: PDFDocumentProxy
  index: number
  scale: number
  size: PageSize
  onActive: (index: number) => void
}) {
  const holder = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const textLayer = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)

  useEffect(() => {
    const el = holder.current
    if (!el) return
    const nearObserver = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: '900px 0px' })
    // Dải giữa màn hình quyết định "đang ở trang nào"
    const activeObserver = new IntersectionObserver(([e]) => e.isIntersecting && onActive(index), { rootMargin: '-45% 0px -45% 0px' })
    nearObserver.observe(el)
    activeObserver.observe(el)
    return () => {
      nearObserver.disconnect()
      activeObserver.disconnect()
    }
  }, [index, onActive])

  useEffect(() => {
    const canvasEl = canvas.current
    const textEl = textLayer.current
    if (!near || !canvasEl || !textEl) return
    let cancelled = false
    let release: (() => void) | undefined
    void doc.getPage(index + 1).then(async (page) => {
      if (cancelled) return
      const viewport = page.getViewport({ scale })
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      canvasEl.width = Math.floor(viewport.width * dpr)
      canvasEl.height = Math.floor(viewport.height * dpr)
      const task = page.render({ canvas: canvasEl, viewport, transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0] })
      const text = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: textEl, viewport })
      release = () => {
        task.cancel()
        text.cancel()
        textEl.replaceChildren()
        canvasEl.width = canvasEl.height = 0 // giải phóng bộ nhớ ảnh
        page.cleanup()
      }
      if (cancelled) return release()
      await Promise.allSettled([task.promise, text.render()])
    })
    return () => {
      cancelled = true
      release?.()
    }
  }, [doc, index, near, scale])

  return (
    <div
      ref={holder}
      data-page={index + 1}
      style={{ width: size.width * scale, height: size.height * scale, ['--total-scale-factor' as string]: scale }}
      className="relative mx-auto shrink-0 bg-white shadow-md ring-1 ring-black/5"
    >
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
      <div ref={textLayer} className="textLayer" />
    </div>
  )
}

// Trình xem PDF của N7AI: cuộn liên tục, vừa chiều rộng, phóng to, chọn / sao chép chữ
export default function PdfView({ url }: { url: string }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [size, setSize] = useState<PageSize | null>(null)
  const [error, setError] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [current, setCurrent] = useState(0)
  const [width, stageRef, stage] = useElementWidth()

  useEffect(() => {
    let stale = false // cleanup huỷ tác vụ tải (kể cả StrictMode mount đôi) ⇒ bỏ qua kết quả / lỗi "aborted" của lần cũ
    const task = pdfjs.getDocument({ url: fileSourceUrl(url), withCredentials: true })
    task.promise
      .then(async (loaded) => {
        const first = (await loaded.getPage(1)).getViewport({ scale: 1 })
        if (stale) return
        setSize({ width: first.width, height: first.height })
        setDoc(loaded)
      })
      .catch((err) => {
        if (stale) return
        console.error('[pdf]', err)
        setError(true)
      })
    return () => {
      stale = true
      void task.destroy()
    }
  }, [url])

  const goTo = useCallback(
    (index: number) => {
      stage?.querySelector(`[data-page="${index + 1}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    },
    [stage]
  )

  if (error) return <ViewerError />
  if (!doc || !size) return <ViewerLoading />

  const fit = width > 0 ? (width - GUTTER * 2) / size.width : 1
  const scale = Math.max(0.2, fit * zoom)
  return (
    <Stage
      scrollRef={stageRef}
      className="scroll-smooth"
      bar={
        <FloatingBar>
          <button type="button" className={barButton} disabled={current <= 0} onClick={() => goTo(current - 1)} aria-label="Trang trước">
            <ChevronUp className="h-4 w-4" />
          </button>
          <span className="min-w-12 text-center text-xs font-medium tabular-nums text-muted-foreground">
            {current + 1} / {doc.numPages}
          </span>
          <button type="button" className={barButton} disabled={current >= doc.numPages - 1} onClick={() => goTo(current + 1)} aria-label="Trang sau">
            <ChevronDown className="h-4 w-4" />
          </button>
          <span className="mx-1 h-4 w-px bg-border" />
          <ZoomControls zoom={zoom} min={0.5} max={3} step={0.25} onChange={setZoom} />
        </FloatingBar>
      }
    >
      <div
        className={cn('flex min-h-full flex-col gap-3 py-4 pb-20', width === 0 && 'invisible')}
        style={{ width: Math.max(width, size.width * scale + GUTTER * 2) }}
      >
        {Array.from({ length: doc.numPages }, (_, i) => (
          <PdfPage key={i} doc={doc} index={i} scale={scale} size={size} onActive={setCurrent} />
        ))}
      </div>
    </Stage>
  )
}
