'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useFileBytes } from '../use-file-bytes'
import { OfficeEmbed } from './office-embed'
import { Stage, useElementWidth, ViewerError, ViewerLoading } from './viewer-parts'

const MAX_WIDTH = 960

// PowerPoint (.pptx): các slide xếp dọc, dựng trong trình duyệt bằng pptx-preview; lỗi ⇒ Office Online
export default function PptxView({ url, name }: { url: string; name: string }) {
  const { data, isError } = useFileBytes(url)
  const host = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [width, stageRef] = useElementWidth()
  const slideWidth = Math.min(MAX_WIDTH, width - 32)

  useEffect(() => {
    const el = host.current
    if (!data || !el || slideWidth < 200) return
    let stale = false
    let destroy: (() => void) | undefined
    el.replaceChildren()
    import('pptx-preview')
      .then(async ({ init }) => {
        const previewer = init(el, { width: slideWidth, height: Math.round((slideWidth * 9) / 16), mode: 'list' })
        destroy = () => previewer.destroy()
        // pptx-preview đọc buffer trực tiếp ⇒ đưa bản sao để cache không bị ảnh hưởng
        await previewer.preview(data.slice(0))
        if (!stale) setState('ready')
      })
      .catch(() => !stale && setState('error'))
    return () => {
      stale = true
      destroy?.()
    }
  }, [data, slideWidth])

  if (isError) return <ViewerError />
  if (state === 'error') return <OfficeEmbed url={url} name={name} />
  return (
    <Stage scrollRef={stageRef}>
      {state === 'loading' && <ViewerLoading label="Đang dựng slide…" />}
      <div ref={host} className="mx-auto w-max py-4 [&_.pptx-preview-wrapper]:bg-transparent!" />
    </Stage>
  )
}
