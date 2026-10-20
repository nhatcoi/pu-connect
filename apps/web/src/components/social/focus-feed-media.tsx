'use client'

import { useEffect, useRef, useState } from 'react'

function FocusVideo({ src, active }: { src: string; active: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const video = ref.current
    if (!video) return
    const sync = () => {
      if (active && !document.hidden) void video.play().catch(() => undefined)
      else video.pause()
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      video.pause()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [active])
  return (
    <video
      ref={ref}
      src={src}
      controls
      muted
      playsInline
      loop
      preload={active ? 'metadata' : 'none'}
      className="h-full w-full object-contain"
      aria-label="Video bài viết"
    />
  )
}

export function FocusFeedMedia({ urls, active }: { urls: string[]; active: boolean }) {
  const [slide, setSlide] = useState(0)
  return (
    <div className="relative h-full min-h-0 w-full">
      <div
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain no-scrollbar"
        onScroll={(e) => {
          const el = e.currentTarget
          setSlide(Math.round(el.scrollLeft / el.clientWidth))
        }}
        aria-label="Ảnh và video bài viết"
      >
        {urls.map((url, index) => (
          <div key={`${url}:${index}`} className="h-full w-full shrink-0 snap-center snap-always">
            {/\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(url) ? (
              <FocusVideo src={url} active={active && slide === index} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- user media, bounded viewport
              <img
                src={url}
                alt={`Ảnh bài viết ${index + 1}`}
                loading={active && slide === index ? 'eager' : 'lazy'}
                className="h-full w-full object-contain"
              />
            )}
          </div>
        ))}
      </div>
      {urls.length > 1 && (
        <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs text-foreground">
          {slide + 1} / {urls.length} · Vuốt ngang
        </span>
      )}
    </div>
  )
}
