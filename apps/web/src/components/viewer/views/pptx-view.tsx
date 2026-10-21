'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LayoutList,
  Maximize2,
  Minimize2,
  Presentation
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFileBytes } from '../use-file-bytes'
import { OfficeEmbed } from './office-embed'
import {
  barButton,
  FloatingBar,
  Stage,
  useElementWidth,
  ViewerError,
  ViewerLoading,
  ZoomControls
} from './viewer-parts'

const BASE_WIDTH = 960
const BASE_HEIGHT = 540

interface PptxPreviewerInstance {
  slideCount: number
  currentIndex: number
  renderSingleSlide: (index: number) => void
  renderNextSlide?: () => void
  renderPreSlide?: () => void
  destroy?: () => void
}

// PowerPoint (.pptx): Trình chiếu từng slide (Presentation) hoặc cuộn dọc (List), phím tắt mũi tên, zoom và toàn màn hình
export default function PptxView({ url, name }: { url: string; name: string }) {
  const { data, isError } = useFileBytes(url)
  const host = useRef<HTMLDivElement>(null)
  const previewerRef = useRef<PptxPreviewerInstance | null>(null)

  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [slideCount, setSlideCount] = useState(0)
  const [currentSlide, setCurrentSlide] = useState(0)
  const currentSlideRef = useRef(currentSlide)
  currentSlideRef.current = currentSlide
  const [viewMode, setViewMode] = useState<'slide' | 'list'>('slide')
  const [zoom, setZoom] = useState(1)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [forceOffice, setForceOffice] = useState(false)

  const [stageWidth, stageRef, stageEl] = useElementWidth()

  // Hệ số co giãn vừa vặn khung hiển thị mà không làm vỡ tỉ lệ hay font chữ
  const autoFit = stageWidth > 0 ? Math.min(1.5, Math.max(0.2, (stageWidth - 48) / BASE_WIDTH)) : 1
  const effectiveScale = autoFit * zoom

  // Dựng slide trong DOM
  useEffect(() => {
    const el = host.current
    if (!data || !el) return
    let stale = false
    let destroy: (() => void) | undefined
    el.replaceChildren()
    setState('loading')

    import('pptx-preview')
      .then(async ({ init }) => {
        // Trong mode slide: cần height cố định. Trong mode list: không truyền height để các slide tự trải dài tự nhiên
        const options: { width: number; height?: number; mode: 'slide' | 'list' } = {
          width: BASE_WIDTH,
          mode: viewMode
        }
        if (viewMode === 'slide') {
          options.height = BASE_HEIGHT
        }

        const previewer = init(el, options) as unknown as PptxPreviewerInstance
        destroy = () => previewer.destroy?.()

        await (previewer as unknown as { preview: (buf: ArrayBuffer) => Promise<unknown> }).preview(data.slice(0))

        if (!previewer.slideCount) throw new Error('pptx: không có slide')

        if (!stale) {
          previewerRef.current = previewer
          setSlideCount(previewer.slideCount)
          setState('ready')

          // Giữ đúng vị trí slide hiện tại khi chuyển chế độ
          const initialSlide = currentSlideRef.current
          if (viewMode === 'slide' && initialSlide > 0) {
            previewer.renderSingleSlide(Math.min(initialSlide, previewer.slideCount - 1))
          }
        }
      })
      .catch((err) => {
        console.error('[pptx-preview error]', err)
        if (!stale) setState('error')
      })

    return () => {
      stale = true
      destroy?.()
      previewerRef.current = null
    }
  }, [data, viewMode])

  // Chuyển tới slide mục tiêu
  const goToSlide = useCallback(
    (index: number) => {
      if (index < 0 || index >= slideCount) return
      setCurrentSlide(index)

      if (viewMode === 'slide') {
        previewerRef.current?.renderSingleSlide(index)
      } else {
        const targetEl = stageEl?.querySelector(`[class*="pptx-preview-slide-wrapper-${index}"]`)
        targetEl?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    },
    [slideCount, viewMode, stageEl]
  )

  // Ở chế độ cuộn dọc (list), theo dõi slide đang xuất hiện ở giữa màn hình
  useEffect(() => {
    if (viewMode !== 'list' || state !== 'ready' || !stageEl || slideCount === 0) return

    const slideEls = stageEl.querySelectorAll<HTMLElement>('[class*="pptx-preview-slide-wrapper-"]')
    if (!slideEls.length) return

    const observers: IntersectionObserver[] = []
    slideEls.forEach((el, index) => {
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setCurrentSlide(index)
          }
        },
        { root: stageEl, rootMargin: '-40% 0px -40% 0px' }
      )
      obs.observe(el)
      observers.push(obs)
    })

    return () => {
      observers.forEach((o) => o.disconnect())
    }
  }, [viewMode, state, stageEl, slideCount])

  // Toàn màn hình (Presentation Fullscreen)
  const toggleFullscreen = useCallback(() => {
    const root = stageEl?.parentElement || stageEl
    if (!document.fullscreenElement) {
      root?.requestFullscreen?.().catch((err) => console.warn('[pptx] Fullscreen failed', err))
    } else {
      document.exitFullscreen?.().catch((err) => console.warn('[pptx] Exit fullscreen failed', err))
    }
  }, [stageEl])

  // Lắng nghe thay đổi trạng thái toàn màn hình
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  // Phím tắt bàn phím: ← / →, Space, PageUp / PageDown, F (Fullscreen), Home / End
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return

      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        goToSlide(currentSlide + 1)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        goToSlide(currentSlide - 1)
      } else if (e.key === 'Home') {
        e.preventDefault()
        goToSlide(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        goToSlide(slideCount - 1)
      } else if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        toggleFullscreen()
      } else if (e.key === 'Escape' && pickerOpen) {
        setPickerOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goToSlide, currentSlide, slideCount, toggleFullscreen, pickerOpen])

  if (isError) return <ViewerError />
  if (state === 'error' || forceOffice) return <OfficeEmbed url={url} name={name} />

  return (
    <Stage
      scrollRef={stageRef}
      className={cn('relative scroll-smooth', isFullscreen && 'bg-black/95 text-white')}
      bar={
        state === 'ready' && (
          <FloatingBar className="gap-1 px-2.5 py-1 shadow-2xl ring-1 ring-border/80">
            {/* Nút lùi slide */}
            <button
              type="button"
              className={barButton}
              disabled={currentSlide <= 0}
              onClick={() => goToSlide(currentSlide - 1)}
              title="Slide trước (← hoặc PageUp)"
              aria-label="Slide trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Bộ chọn số slide popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                title="Bấm để chọn nhanh slide"
                aria-expanded={pickerOpen}
                className="flex h-8 cursor-pointer items-center gap-1 rounded-full px-2 text-xs font-semibold tabular-nums text-foreground transition-colors hover:bg-muted"
              >
                <span>
                  {currentSlide + 1} / {slideCount}
                </span>
                <ChevronDown className={cn('h-3 w-3 text-muted-foreground transition-transform', pickerOpen && 'rotate-180')} />
              </button>

              {pickerOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} aria-hidden />
                  <div className="absolute bottom-full left-1/2 z-50 mb-2 max-h-60 w-64 -translate-x-1/2 overflow-y-auto rounded-2xl border bg-card/95 p-2 shadow-2xl backdrop-blur-md">
                    <p className="border-b px-1.5 pb-1.5 text-[11px] font-semibold text-muted-foreground">
                      Danh sách slide ({slideCount} trang)
                    </p>
                    <div className="grid grid-cols-5 gap-1 pt-1.5">
                      {Array.from({ length: slideCount }, (_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            goToSlide(i)
                            setPickerOpen(false)
                          }}
                          className={cn(
                            'flex h-8 cursor-pointer items-center justify-center rounded-lg text-xs font-medium transition-colors',
                            i === currentSlide
                              ? 'bg-primary font-bold text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          )}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Nút tiến slide */}
            <button
              type="button"
              className={barButton}
              disabled={currentSlide >= slideCount - 1}
              onClick={() => goToSlide(currentSlide + 1)}
              title="Slide sau (→ hoặc Space hoặc PageDown)"
              aria-label="Slide sau"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <div className="mx-1 h-4 w-px bg-border/60" />

            {/* Điều khiển thu phóng Zoom */}
            <ZoomControls zoom={zoom} min={0.5} max={2} step={0.25} onChange={setZoom} />

            <div className="mx-1 h-4 w-px bg-border/60" />

            {/* Chuyển chế độ: Trình chiếu 1 slide vs Cuộn dọc liên tục */}
            <button
              type="button"
              className={barButton}
              onClick={() => setViewMode((m) => (m === 'slide' ? 'list' : 'slide'))}
              title={viewMode === 'slide' ? 'Chuyển sang chế độ cuộn dọc danh sách' : 'Chuyển sang chế độ trình chiếu từng slide'}
              aria-label="Đổi chế độ xem slide"
            >
              {viewMode === 'slide' ? <LayoutList className="h-4 w-4" /> : <Presentation className="h-4 w-4" />}
            </button>

            {/* Bật / tắt toàn màn hình */}
            <button
              type="button"
              className={barButton}
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Thu nhỏ (Esc)' : 'Toàn màn hình trình chiếu (F)'}
              aria-label="Toàn màn hình"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>

            {/* Tùy chọn mở Office Online nếu người dùng muốn đối chiếu */}
            <button
              type="button"
              className={barButton}
              onClick={() => setForceOffice(true)}
              title="Mở bằng Office Online (Microsoft)"
              aria-label="Mở qua Office Online"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </FloatingBar>
        )
      }
    >
      {state === 'loading' && <ViewerLoading label="Đang dựng slide thuyết trình…" />}

      {/* Vùng chứa slide được scale mượt bằng CSS zoom */}
      <div
        ref={host}
        style={{ zoom: effectiveScale }}
        className={cn(
          'mx-auto w-max py-4 pb-24 transition-[zoom] duration-150',
          '[&_.pptx-preview-wrapper]:bg-transparent!',
          '[&_.pptx-preview-wrapper-next]:!hidden',
          '[&_.pptx-preview-wrapper-pagination]:!hidden',
          '[&_[class*="pptx-preview-slide-wrapper-"]]:rounded-xl!',
          '[&_[class*="pptx-preview-slide-wrapper-"]]:shadow-xl!',
          '[&_[class*="pptx-preview-slide-wrapper-"]]:ring-1!',
          '[&_[class*="pptx-preview-slide-wrapper-"]]:ring-border/80!',
          '[&_[class*="pptx-preview-slide-wrapper-"]]:bg-card!',
          viewMode === 'list' && '[&_[class*="pptx-preview-slide-wrapper-"]]:!mb-6'
        )}
      />
    </Stage>
  )
}
