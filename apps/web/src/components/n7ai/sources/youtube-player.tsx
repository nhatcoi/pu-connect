'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const ORIGIN = 'https://www.youtube-nocookie.com'

// Trình phát YouTube nhúng tối ưu cho học tập (Focus Mode), điều khiển qua postMessage (IFrame API không cần tải script ngoài):
// - iv_load_policy=3: tắt pop-up annotations, subscribe cards của creator
// - cc_load_policy=0: tắt phụ đề YouTube đè lên bài giảng (vì đã có panel transcript riêng bên dưới)
// - rel=0: chỉ gợi ý video cùng kênh, tránh thuật toán kéo sang video xao nhãng khác
// - Tua tới giây bất kỳ, tua nhanh ±5s, đổi tốc độ phát (0.75x - 2x)
// - Bắt sự kiện kết thúc (playerState = 0) để phủ màn hình học tập kết bài (chặn lưới video đề xuất)
export function useYoutubePlayer() {
  const frame = useRef<HTMLIFrameElement>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playerState, setPlayerState] = useState<number>(-1)
  const [isEnded, setIsEnded] = useState(false)
  const [playbackRate, setPlaybackRateState] = useState(1)

  const post = useCallback((payload: object) => frame.current?.contentWindow?.postMessage(JSON.stringify(payload), ORIGIN), [])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== ORIGIN || e.source !== frame.current?.contentWindow || typeof e.data !== 'string') return
      try {
        const data = JSON.parse(e.data) as {
          event?: string
          info?: { currentTime?: number; playerState?: number; duration?: number; playbackRate?: number }
          data?: number
        }

        // YouTube gửi infoDelivery định kỳ và khi thay đổi trạng thái
        if (data.event === 'infoDelivery' && data.info) {
          if (typeof data.info.currentTime === 'number') setCurrentTime(data.info.currentTime)
          if (typeof data.info.duration === 'number' && data.info.duration > 0) setDuration(data.info.duration)
          if (typeof data.info.playbackRate === 'number') setPlaybackRateState(data.info.playbackRate)
          if (typeof data.info.playerState === 'number') {
            setPlayerState(data.info.playerState)
            if (data.info.playerState === 0) setIsEnded(true)
            else if (data.info.playerState === 1) setIsEnded(false)
          }
        } else if (data.event === 'onStateChange') {
          const state = typeof data.info === 'number' ? data.info : data.data
          if (typeof state === 'number') {
            setPlayerState(state)
            if (state === 0) setIsEnded(true)
            else if (state === 1) setIsEnded(false)
          }
        }
      } catch {
        // Thông điệp không phải JSON của YouTube
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Báo cho trình phát biết ta đang lắng nghe (bắt buộc để nhận infoDelivery)
  const listen = useCallback(() => post({ event: 'listening', id: 1, channel: 'widget' }), [post])

  const seekTo = useCallback(
    (seconds: number) => {
      const clamped = Math.max(0, seconds)
      post({ event: 'command', func: 'seekTo', args: [clamped, true] })
      post({ event: 'command', func: 'playVideo', args: [] })
      setCurrentTime(clamped)
      setIsEnded(false)
    },
    [post]
  )

  const seekBy = useCallback(
    (delta: number) => {
      seekTo(currentTime + delta)
    },
    [seekTo, currentTime]
  )

  const setPlaybackRate = useCallback(
    (rate: number) => {
      post({ event: 'command', func: 'setPlaybackRate', args: [rate] })
      setPlaybackRateState(rate)
    },
    [post]
  )

  const replay = useCallback(() => {
    seekTo(0)
  }, [seekTo])

  const dismissEndOverlay = useCallback(() => {
    setIsEnded(false)
  }, [])

  return {
    frame,
    currentTime,
    duration,
    playerState,
    isEnded,
    playbackRate,
    listen,
    seekTo,
    seekBy,
    setPlaybackRate,
    replay,
    dismissEndOverlay
  }
}

export function YoutubeFrame({
  videoId,
  title,
  frame,
  onLoad,
  overlay,
  className
}: {
  videoId: string
  title: string
  frame: React.RefObject<HTMLIFrameElement | null>
  onLoad: () => void
  overlay?: React.ReactNode
  className?: string
}) {
  // Tham số nhúng tối ưu cho tập trung học tập:
  // - rel=0: chỉ video cùng kênh
  // - iv_load_policy=3: tắt toàn bộ annotation/popup quấy rầy của uploader
  // - cc_load_policy=0: không hiển thị phụ đề mặc định che slide/video
  // - modestbranding=1: tối giản logo
  // - playsinline=1: phát nội tuyến trên mobile
  const src = `${ORIGIN}/embed/${videoId}?enablejsapi=1&rel=0&iv_load_policy=3&cc_load_policy=0&modestbranding=1&playsinline=1&origin=${encodeURIComponent(typeof window === 'undefined' ? '' : window.location.origin)}`

  return (
    <div className={cn('relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-sm ring-1 ring-border/50', className)}>
      <iframe
        ref={frame}
        src={src}
        title={title}
        onLoad={onLoad}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className="h-full w-full border-0"
      />
      {overlay}
    </div>
  )
}
