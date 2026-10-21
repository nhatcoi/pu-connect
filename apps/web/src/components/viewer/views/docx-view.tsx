'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useFileBytes } from '../use-file-bytes'
import { FloatingBar, Stage, useElementWidth, useFitToWidth, ViewerError, ViewerLoading, ZoomControls } from './viewer-parts'

// Word (.docx) dựng ngay trong trình duyệt bằng docx-preview; trang giấy tự co vừa khung
export default function DocxView({ url }: { url: string }) {
  const { data, isError } = useFileBytes(url)
  const host = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [zoom, setZoom] = useState(1)
  const [width, stageRef] = useElementWidth()
  const fit = useFitToWidth(host, width, state === 'ready')

  useEffect(() => {
    const el = host.current
    if (!data || !el) return
    let stale = false
    el.replaceChildren()
    import('docx-preview')
      .then(({ renderAsync }) => renderAsync(data, el, undefined, { className: 'docx', inWrapper: true, breakPages: true, ignoreLastRenderedPageBreak: true }))
      .then(() => !stale && setState('ready'))
      .catch(() => !stale && setState('error'))
    return () => {
      stale = true
    }
  }, [data])

  if (isError || state === 'error') return <ViewerError />
  return (
    <Stage
      scrollRef={stageRef}
      bar={
        state === 'ready' && (
          <FloatingBar>
            <ZoomControls zoom={zoom} min={0.5} max={2} step={0.25} onChange={setZoom} />
          </FloatingBar>
        )
      }
    >
      {state === 'loading' && <ViewerLoading />}
      <div
        ref={host}
        style={{ zoom: fit * zoom }}
        className="mx-auto w-max py-4 pb-20 [&_.docx-wrapper]:bg-transparent! [&_.docx-wrapper]:p-0! [&_.docx-wrapper>section.docx]:mb-3! [&_.docx-wrapper>section.docx]:shadow-md!"
      />
    </Stage>
  )
}
