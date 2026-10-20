'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ZoomIn, ChevronLeft, ChevronRight, X, AlertCircle } from 'lucide-react'

interface PostMediaGalleryProps {
  mediaUrls: string[]
  className?: string
}

const isVideoUrl = (url: string) => /\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(url)

export function PostMediaGallery({ mediaUrls, className }: PostMediaGalleryProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [failedUrls, setFailedUrls] = useState<Record<string, boolean>>({})

  const handleImageError = useCallback((url: string) => {
    setFailedUrls((prev) => ({ ...prev, [url]: true }))
  }, [])

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (selectedIdx === null) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setSelectedIdx((prev) => (prev !== null && prev > 0 ? prev - 1 : mediaUrls.length - 1))
      } else if (e.key === 'ArrowRight') {
        setSelectedIdx((prev) => (prev !== null && prev < mediaUrls.length - 1 ? prev + 1 : 0))
      } else if (e.key === 'Escape') {
        setSelectedIdx(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIdx, mediaUrls.length])

  if (!mediaUrls || mediaUrls.length === 0) return null

  // 1 Image: preserve natural aspect ratio, bounded by max-height (like Twitter/Threads)
  if (mediaUrls.length === 1) {
    const url = mediaUrls[0]
    const isVideo = isVideoUrl(url)
    const isFailed = failedUrls[url]

    return (
      <>
        <div
          className={cn(
            'group relative mt-2.5 overflow-hidden rounded-2xl border border-border/80 bg-muted/20 w-fit max-w-full transition-all duration-200',
            className
          )}
        >
          {isVideo ? (
            <video
              src={url}
              controls
              playsInline
              preload="metadata"
              className="max-h-[520px] w-auto max-w-full rounded-2xl bg-black"
            />
          ) : isFailed ? (
            <div className="flex h-48 w-72 items-center justify-center gap-2 text-xs text-muted-foreground p-4">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              <span>Không thể tải hình ảnh</span>
            </div>
          ) : (
            <div
              onClick={(e) => {
                e.stopPropagation()
                setSelectedIdx(0)
              }}
              className="relative cursor-pointer overflow-hidden rounded-2xl"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- ảnh bài viết từ R2, tỉ lệ động */}
              <img
                src={url}
                alt="Ảnh đính kèm bài viết"
                loading="lazy"
                onError={() => handleImageError(url)}
                className="block max-h-[520px] w-auto max-w-full rounded-2xl object-contain transition-transform duration-300 group-hover:scale-[1.01]"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center pointer-events-none">
                <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-90 transition-opacity drop-shadow-md" />
              </div>
            </div>
          )}
        </div>

        {/* Lightbox Modal */}
        <LightboxModal
          isOpen={selectedIdx !== null}
          urls={mediaUrls}
          currentIndex={selectedIdx ?? 0}
          onClose={() => setSelectedIdx(null)}
          onNavigate={(nextIdx) => setSelectedIdx(nextIdx)}
        />
      </>
    )
  }

  // 2, 3, 4+ Images: Grid layout
  const displayUrls = mediaUrls.slice(0, 4)
  const remainingCount = mediaUrls.length - 4

  return (
    <>
      <div
        className={cn(
          'mt-2.5 grid gap-1.5 overflow-hidden rounded-2xl border border-border/80 bg-muted/20 w-full',
          mediaUrls.length === 2 && 'grid-cols-2',
          mediaUrls.length === 3 && 'grid-cols-2',
          mediaUrls.length >= 4 && 'grid-cols-2',
          className
        )}
      >
        {displayUrls.map((url, idx) => {
          const isVideo = isVideoUrl(url)
          const isLastWithMore = idx === 3 && remainingCount > 0

          return (
            <div
              key={url + idx}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedIdx(idx)
              }}
              className={cn(
                'group relative overflow-hidden bg-black/5 cursor-pointer transition-all duration-200',
                mediaUrls.length === 2 && 'h-64 sm:h-72 w-full',
                mediaUrls.length === 3 && idx === 0 && 'row-span-2 h-full min-h-[260px] sm:min-h-[300px]',
                mediaUrls.length === 3 && idx > 0 && 'h-[128px] sm:h-[148px]',
                mediaUrls.length >= 4 && 'h-40 sm:h-48'
              )}
            >
              {isVideo ? (
                <video
                  src={url}
                  playsInline
                  muted
                  preload="metadata"
                  className="h-full w-full object-cover"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element -- ảnh bài viết từ R2, tỉ lệ động */
                <img
                  src={url}
                  alt={`Ảnh đính kèm bài viết ${idx + 1}`}
                  loading="lazy"
                  onError={() => handleImageError(url)}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              )}

              {isLastWithMore ? (
                <div className="absolute inset-0 bg-black/55 flex items-center justify-center backdrop-blur-xs transition-opacity hover:bg-black/65">
                  <span className="text-white text-xl sm:text-2xl font-bold tracking-tight">+{remainingCount + 1}</span>
                </div>
              ) : (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors flex items-center justify-center pointer-events-none">
                  <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-90 transition-opacity drop-shadow-md" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Lightbox Modal */}
      <LightboxModal
        isOpen={selectedIdx !== null}
        urls={mediaUrls}
        currentIndex={selectedIdx ?? 0}
        onClose={() => setSelectedIdx(null)}
        onNavigate={(nextIdx) => setSelectedIdx(nextIdx)}
      />
    </>
  )
}

interface LightboxModalProps {
  isOpen: boolean
  urls: string[]
  currentIndex: number
  onClose: () => void
  onNavigate: (index: number) => void
}

function LightboxModal({ isOpen, urls, currentIndex, onClose, onNavigate }: LightboxModalProps) {
  if (!isOpen || !urls[currentIndex]) return null

  const currentUrl = urls[currentIndex]
  const isVideo = isVideoUrl(currentUrl)
  const hasMultiple = urls.length > 1

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl p-2 bg-black/95 border-none shadow-2xl overflow-hidden rounded-2xl flex items-center justify-center focus:outline-none">
        <DialogTitle className="sr-only">Xem chi tiết ảnh đính kèm bài viết</DialogTitle>

        {/* Close Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="absolute top-3 right-3 z-50 p-2 rounded-full bg-black/60 text-white/80 hover:text-white hover:bg-black/80 transition-colors cursor-pointer"
          aria-label="Đóng xem ảnh"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Counter Badge */}
        {hasMultiple && (
          <div className="absolute top-3 left-3 z-50 px-3 py-1 rounded-full bg-black/60 text-white text-xs font-medium tracking-wide">
            {currentIndex + 1} / {urls.length}
          </div>
        )}

        {/* Prev Button */}
        {hasMultiple && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onNavigate(currentIndex > 0 ? currentIndex - 1 : urls.length - 1)
            }}
            className="absolute left-3 z-50 p-2.5 rounded-full bg-black/60 text-white/80 hover:text-white hover:bg-black/80 transition-colors cursor-pointer"
            aria-label="Ảnh trước"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {/* Media Content */}
        <div className="relative max-h-[85vh] w-full flex items-center justify-center p-2">
          {isVideo ? (
            <video
              src={currentUrl}
              controls
              autoPlay
              playsInline
              className="max-h-[82vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element -- ảnh phóng to */
            <img
              src={currentUrl}
              alt="Ảnh phóng to chi tiết"
              className="max-h-[82vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
            />
          )}
        </div>

        {/* Next Button */}
        {hasMultiple && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onNavigate(currentIndex < urls.length - 1 ? currentIndex + 1 : 0)
            }}
            className="absolute right-3 z-50 p-2.5 rounded-full bg-black/60 text-white/80 hover:text-white hover:bg-black/80 transition-colors cursor-pointer"
            aria-label="Ảnh tiếp theo"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </DialogContent>
    </Dialog>
  )
}
