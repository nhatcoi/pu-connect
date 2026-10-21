'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

const ORIGIN = 'https://www.youtube-nocookie.com'

// Trình phát YouTube nhúng, điều khiển qua postMessage (IFrame API không cần tải script ngoài):
// tua tới giây bất kỳ và nhận thời điểm đang phát để đánh dấu dòng phụ đề
export function useYoutubePlayer() {
  const frame = useRef<HTMLIFrameElement>(null)
  const [currentTime, setCurrentTime] = useState(0)

  const post = useCallback((payload: object) => frame.current?.contentWindow?.postMessage(JSON.stringify(payload), ORIGIN), [])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== ORIGIN || e.source !== frame.current?.contentWindow || typeof e.data !== 'string') return
      try {
        const data = JSON.parse(e.data) as { event?: string; info?: { currentTime?: number } }
        if (data.event === 'infoDelivery' && typeof data.info?.currentTime === 'number') setCurrentTime(data.info.currentTime)
      } catch {
        // thông điệp không phải JSON của YouTube
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Báo cho trình phát biết ta đang lắng nghe (bắt buộc để nhận infoDelivery)
  const listen = useCallback(() => post({ event: 'listening', id: 1, channel: 'widget' }), [post])
  const seekTo = useCallback(
    (seconds: number) => {
      post({ event: 'command', func: 'seekTo', args: [seconds, true] })
      post({ event: 'command', func: 'playVideo', args: [] })
      setCurrentTime(seconds)
    },
    [post]
  )
  return { frame, currentTime, listen, seekTo }
}

export function YoutubeFrame({ videoId, title, frame, onLoad }: { videoId: string; title: string; frame: React.RefObject<HTMLIFrameElement | null>; onLoad: () => void }) {
  const src = `${ORIGIN}/embed/${videoId}?enablejsapi=1&rel=0&modestbranding=1&playsinline=1&origin=${encodeURIComponent(typeof window === 'undefined' ? '' : window.location.origin)}`
  return (
    <iframe
      ref={frame}
      src={src}
      title={title}
      onLoad={onLoad}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      className="aspect-video w-full rounded-xl border-0 bg-black shadow-sm"
    />
  )
}
