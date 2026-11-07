'use client'

import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { defaultBlockSpecs } from '@blocknote/core'
import { MermaidBlock } from '@/components/renderer/mermaid-block'
import { SvgBlock } from '@/components/renderer/svg-block'
import { PlotBlock } from '@/components/renderer/plot-block'
import { ChartBlock } from '@/components/renderer/chart-block'
import { DataTableBlock } from '@/components/renderer/data-table-block'

/** Khối code có ngôn ngữ hình/bảng ⇒ ghi chú hiện hình như khung chat (mã nằm gập bên dưới, vẫn sửa được). */
const FIGURES: Record<string, (p: { content: string }) => React.ReactElement> = {
  mermaid: (p) => <MermaidBlock {...p} />,
  svg: (p) => <SvgBlock {...p} />,
  plot: (p) => <PlotBlock {...p} />,
  chart: (p) => <ChartBlock {...p} />,
  csv: (p) => <DataTableBlock {...p} />,
  tsv: (p) => <DataTableBlock {...p} />
}

const base = defaultBlockSpecs.codeBlock

export const figureCodeBlock = {
  ...base,
  implementation: {
    ...base.implementation,
    render: (block: any, editor: any) => {
      const out = (base.implementation as any).render(block, editor)
      const Figure = FIGURES[String(block.props.language ?? '').toLowerCase()]
      if (!Figure || !out.contentDOM) return out

      const wrap = document.createElement('div')
      wrap.className = 'dt-note-figure'

      const preview = document.createElement('div')
      preview.contentEditable = 'false'
      preview.className = 'dt-note-figure-view'

      const details = document.createElement('details')
      details.className = 'dt-note-figure-source'
      const summary = document.createElement('summary')
      summary.contentEditable = 'false'
      summary.textContent = 'Mã'
      details.append(summary, out.dom)
      if (!(out.contentDOM.textContent ?? '').trim()) details.open = true // khối mới (trống) ⇒ mở sẵn để gõ

      wrap.append(preview, details)

      let root: Root | null = createRoot(preview)
      let raf = 0
      const draw = () => {
        raf = 0
        root?.render(<Figure content={out.contentDOM.textContent ?? ''} />)
      }
      draw()
      const watch = new MutationObserver(() => {
        if (!raf) raf = requestAnimationFrame(draw)
      })
      watch.observe(out.contentDOM, { childList: true, characterData: true, subtree: true })

      return {
        dom: wrap,
        contentDOM: out.contentDOM,
        destroy: () => {
          out.destroy?.()
          watch.disconnect()
          if (raf) cancelAnimationFrame(raf)
          const r = root
          root = null
          setTimeout(() => r?.unmount(), 0) // tránh unmount giữa lúc React đang render
        }
      }
    }
  }
} as typeof base
