'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { X, ZoomIn } from 'lucide-react'

interface PostMediaGalleryProps {
  mediaUrls: string[]
  className?: string
}

export function PostMediaGallery({ mediaUrls, className }: PostMediaGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  if (!mediaUrls || mediaUrls.length === 0) return null

  return (
    <>
      <div
        className={cn(
          'mt-2.5 overflow-hidden rounded-2xl border border-border/80 bg-muted/20',
          mediaUrls.length === 1 && 'grid-cols-1',
          mediaUrls.length === 2 && 'grid grid-cols-2 gap-1.5',
          mediaUrls.length === 3 && 'grid grid-cols-2 gap-1.5',
          mediaUrls.length >= 4 && 'grid grid-cols-2 gap-1.5',
          className
        )}
      >
        {mediaUrls.slice(0, 4).map((url, idx) => (
          <div
            key={url + idx}
            onClick={(e) => {
              e.stopPropagation()
              setSelectedImage(url)
            }}
            className={cn(
              'group relative overflow-hidden bg-black/5 cursor-pointer transition-all duration-200',
              mediaUrls.length === 1 && 'max-h-[420px] w-full',
              mediaUrls.length === 2 && 'h-64 w-full',
              mediaUrls.length === 3 && idx === 0 && 'row-span-2 h-full min-h-[260px]',
              mediaUrls.length === 3 && idx > 0 && 'h-[128px]',
              mediaUrls.length >= 4 && 'h-40'
            )}
          >
            <img
              src={url}
              alt={`Post media attachment ${idx + 1}`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors flex items-center justify-center">
              <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-90 transition-opacity drop-shadow-md" />
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Fullview Modal */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-1 bg-black/95 border-none shadow-2xl overflow-hidden rounded-2xl flex items-center justify-center">
          {selectedImage && (
            <div className="relative max-h-[85vh] w-full flex items-center justify-center p-2">
              <img
                src={selectedImage}
                alt="Full size attachment"
                className="max-h-[80vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
