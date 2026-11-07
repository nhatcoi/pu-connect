'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { enqueueMermaidRender, getMermaidConfig, loadMermaid } from '@/lib/mermaid'
import { FigureFrame, serializeSvg, useThrottledValue } from './figure-frame'

interface MermaidBlockProps {
  content: string
  isDark?: boolean
  code?: React.ReactNode
}

// Nhãn node của Mermaid là HTML trong <foreignObject>: profile svg thuần xóa mất ⇒ ô trống. Cho phép foreignObject + HTML nhãn (script/handler vẫn bị loại)
const sanitizeMermaid = (svg: string) =>
  DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true, html: true },
    ADD_TAGS: ['foreignObject'],
    HTML_INTEGRATION_POINTS: { foreignobject: true }
  })

// Mã đang stream thường dở dòng cuối ⇒ thử đủ mã, rồi bớt dần tối đa 3 dòng cuối để vẫn vẽ được phần đã hoàn chỉnh
const TRIES = [0, 1, 2, 3]

export function MermaidBlock({ content, isDark, code }: MermaidBlockProps) {
  const rawId = useId()
  const cleanId = rawId.replace(/[^a-zA-Z0-9]/g, '_')
  const containerRef = useRef<HTMLDivElement>(null)
  const source = useThrottledValue(content, 350)
  const [svg, setSvg] = useState('') // hình hợp lệ gần nhất (giữ nguyên khi mã mới chưa parse được)
  const [error, setError] = useState<string | null>(null)
  const [settled, setSettled] = useState(false)
  const seq = useRef(0)

  // Mã dừng đổi 1,5 giây mà vẫn lỗi ⇒ mới báo lỗi (tránh nháy lỗi lúc đang gõ)
  useEffect(() => {
    setSettled(false)
    const t = setTimeout(() => setSettled(true), 1500)
    return () => clearTimeout(t)
  }, [content])

  useEffect(() => {
    let alive = true
    const mine = ++seq.current

    const renderDiagram = async () => {
      const dark = isDark ?? document.documentElement.classList.contains('dark')
      const mermaid = await loadMermaid()
      if (!alive || mine !== seq.current) return
      mermaid.initialize(getMermaidConfig(dark))
      const lines = source.split('\n')
      let lastErr = 'Cú pháp Mermaid không hợp lệ'
      for (const drop of TRIES) {
        const text = lines.slice(0, Math.max(1, lines.length - drop)).join('\n').trim()
        if (!text) break
        try {
          const out = await mermaid.render(`mermaid_${cleanId}_${mine}_${drop}`, text)
          if (!alive || mine !== seq.current) return
          setSvg(sanitizeMermaid(out.svg))
          setError(drop === 0 ? null : 'partial')
          return
        } catch (err) {
          lastErr = err instanceof Error ? err.message : lastErr
          // mermaid để lại phần tử lỗi trong <body> ⇒ dọn
          document.getElementById(`dmermaid_${cleanId}_${mine}_${drop}`)?.remove()
        }
      }
      if (alive && mine === seq.current) setError(lastErr)
    }

    enqueueMermaidRender(renderDiagram)
    return () => {
      alive = false
    }
  }, [source, isDark, cleanId])

  const failed = error && error !== 'partial'
  const showError = failed && settled && !svg
  const view = showError ? (
    <div className="p-3 text-xs text-destructive">
      <p className="font-semibold">Lỗi sơ đồ Mermaid:</p>
      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap">{error}</pre>
    </div>
  ) : svg ? (
    <div ref={containerRef} className="flex justify-center overflow-x-auto p-4 [&_svg]:h-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
  ) : (
    <div ref={containerRef} className="h-40 animate-pulse bg-muted/40" />
  )

  const complete = !error && !!svg && source === content
  return <FigureFrame view={view} code={code ?? <code>{content}</code>} rawCode={content} fileName="so-do.svg" getSvg={complete ? () => serializeSvg(containerRef.current) : undefined} busy={!settled && !complete} />
}
