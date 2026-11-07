'use client'

import React from 'react'
import katex from 'katex'
import { createReactInlineContentSpec } from '@blocknote/react'

const toHex = (s: string) => Array.from(new TextEncoder().encode(s), (b) => b.toString(16).padStart(2, '0')).join('')
const fromHex = (h: string) => new TextDecoder().decode(new Uint8Array((h.match(/../g) ?? []).map((x) => parseInt(x, 16))))

/** Công thức LaTeX nội dòng. Lưu markdown dạng `$…$` (hoặc `$$…$$` khi display). */
export const MathInline = createReactInlineContentSpec(
  {
    type: 'math',
    propSchema: { latex: { default: '' }, display: { default: false } },
    content: 'none'
  },
  {
    render: ({ inlineContent }) => {
      const { latex, display } = inlineContent.props
      let html = ''
      try {
        html = katex.renderToString(latex, { throwOnError: false, displayMode: display, output: 'html' })
      } catch {
        html = ''
      }
      return html ? (
        <span className="dt-note-math" title={latex} dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <code>{latex}</code>
      )
    },
    // Dấu mốc hex để remark không escape `_`, `\`, `{`… ; sau khi xuất markdown sẽ đổi lại thành `$…$`.
    toExternalHTML: ({ inlineContent }) => {
      const { latex, display } = inlineContent.props
      return <span>{`QMATHQ${display ? 'D' : 'I'}${toHex(latex)}QENDQ`}</span>
    }
  }
)

const MATH_RE = /\$\$([\s\S]+?)\$\$|\$(?!\s)([^$\n]*?[^$\s\\])\$(?!\d)/g

/** Thay `$…$` bằng token chỉ gồm chữ/số để parser markdown không phá công thức. */
export function protectMath(md: string): { text: string; items: { latex: string; display: boolean }[] } {
  const items: { latex: string; display: boolean }[] = []
  // Không đụng vào code fence / inline code
  const parts = md.split(/(```[\s\S]*?```|`[^`\n]*`)/g)
  const text = parts
    .map((p, i) =>
      i % 2 === 1
        ? p
        : p.replace(MATH_RE, (_m, block: string | undefined, inline: string | undefined) => {
            const display = block !== undefined
            items.push({ latex: (block ?? inline ?? '').trim(), display })
            return `qmathq${items.length - 1}qendq`
          })
    )
    .join('')
  return { text, items }
}

type Run = { type: string; text?: string; styles?: Record<string, unknown>; [k: string]: unknown }

/** Đổi token trong các đoạn text của block (đệ quy) thành inline `math`. */
export function restoreMath<T extends { content?: unknown; children?: unknown }>(
  blocks: T[],
  items: { latex: string; display: boolean }[]
): T[] {
  if (items.length === 0) return blocks
  const fixRuns = (runs: Run[]): Run[] =>
    runs.flatMap((r) => {
      if (r.type !== 'text' || !r.text || !r.text.includes('qmathq')) return [r]
      const out: Run[] = []
      let last = 0
      for (const m of r.text.matchAll(/qmathq(\d+)qendq/g)) {
        const idx = m.index ?? 0
        if (idx > last) out.push({ ...r, text: r.text.slice(last, idx) })
        const it = items[Number(m[1])]
        out.push(it ? { type: 'math', props: { latex: it.latex, display: it.display } } : { ...r, text: m[0] })
        last = idx + m[0].length
      }
      if (last < r.text.length) out.push({ ...r, text: r.text.slice(last) })
      return out
    })
  const walk = (b: T): T => {
    const next: Record<string, unknown> = { ...b }
    if (Array.isArray(b.content)) next.content = fixRuns(b.content as Run[])
    if (Array.isArray(b.children)) next.children = (b.children as T[]).map(walk)
    return next as T
  }
  return blocks.map(walk)
}

/** Khôi phục token hex trong markdown xuất ra thành `$…$`. */
export function exportMath(md: string): string {
  return md.replace(/QMATHQ([ID])([0-9a-f]*)QENDQ/g, (_m, kind: string, hex: string) => {
    const latex = fromHex(hex)
    return kind === 'D' ? `$$${latex}$$` : `$${latex}$`
  })
}
