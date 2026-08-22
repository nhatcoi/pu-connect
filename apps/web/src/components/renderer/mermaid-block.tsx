'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { enqueueMermaidRender, getMermaidConfig, loadMermaid } from '@/lib/mermaid'

interface MermaidBlockProps {
  content: string
  isDark?: boolean
}

export function MermaidBlock({ content, isDark = false }: MermaidBlockProps) {
  const rawId = useId()
  const cleanId = rawId.replace(/[:]/g, '_')
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const renderDiagram = async () => {
      try {
        const mermaid = await loadMermaid()
        if (!isMounted) return

        mermaid.initialize(getMermaidConfig(isDark))
        const { svg } = await mermaid.render(`mermaid_${cleanId}`, content)

        if (isMounted && containerRef.current) {
          containerRef.current.innerHTML = DOMPurify.sanitize(svg, {
            USE_PROFILES: { svg: true }
          })
          setError(null)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Invalid Mermaid syntax')
          const errorEl = document.getElementById(`dmermaid_${cleanId}`)
          errorEl?.remove()
        }
      }
    }

    enqueueMermaidRender(renderDiagram)

    return () => {
      isMounted = false
    }
  }, [content, isDark, cleanId])

  if (error) {
    return (
      <div className="my-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
        <p className="font-semibold">Lỗi sơ đồ Mermaid:</p>
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap">{error}</pre>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="my-4 flex justify-center overflow-x-auto rounded-lg border bg-card p-4 shadow-xs"
    />
  )
}
