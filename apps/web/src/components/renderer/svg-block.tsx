'use client'

import React, { useEffect, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { FigureFrame, serializeSvg, useThrottledValue } from './figure-frame'

/** Co giãn theo khung: thêm viewBox từ width/height nếu thiếu, bỏ kích thước cố định. */
function fitSvg(html: string): string {
  if (typeof DOMParser === 'undefined') return html
  const doc = new DOMParser().parseFromString(html, 'image/svg+xml')
  const svg = doc.documentElement
  if (!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) return html
  const num = (v: string | null) => (v && /^\d+(\.\d+)?(px)?$/.test(v.trim()) ? parseFloat(v) : 0)
  const w = num(svg.getAttribute('width'))
  const h = num(svg.getAttribute('height'))
  if (!svg.getAttribute('viewBox') && w && h) svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
  if (svg.getAttribute('viewBox')) {
    svg.removeAttribute('width')
    svg.removeAttribute('height')
  }
  return new XMLSerializer().serializeToString(svg)
}

const SVG_START = /^\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/

/** Mã bắt đầu bằng `<svg` (kể cả chưa gõ xong ⇒ vẽ dần khi stream). */
export function isSvgStart(code: string): boolean {
  return SVG_START.test(code)
}

/** Cắt thẻ / thuộc tính đang gõ dở ở cuối để phần còn lại vẫn parse được; DOMPurify tự đóng các thẻ còn mở. */
function trimPartial(code: string): string {
  return code
    .replace(/^\s*<\?xml[^>]*\?>\s*/, '')
    .replace(/<!--(?![\s\S]*-->)[\s\S]*$/, '') // comment chưa đóng
    .replace(/<[^<>]*$/, '') // thẻ chưa có '>'
}

/**
 * Hình SVG do AI vẽ: tab Hình / Mã, sao chép, tải .svg. Vẽ dần khi mã còn đang stream.
 * Nhúng trực tiếp (không <img>) để dùng lớp màu sáng/tối (.svg-figure trong globals.css); DOMPurify bỏ script / on*.
 */
export function SvgBlock({ content, code }: { content: string; code?: React.ReactNode }) {
  const source = useThrottledValue(content)
  const complete = /<\/svg>\s*$/.test(content)
  const boxRef = useRef<HTMLDivElement>(null)
  // DOMPurify/DOMParser chỉ có ở trình duyệt ⇒ tính sau khi mount (SSR không lệch hydration)
  const [html, setHtml] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    try {
      const clean = DOMPurify.sanitize(trimPartial(source), { USE_PROFILES: { svg: true, svgFilters: true } })
      setHtml(clean ? fitSvg(clean) : '')
    } catch {
      setHtml(null)
    }
  }, [source])

  const view = html ? (
    <div ref={boxRef} className="svg-figure flex justify-center overflow-x-auto p-4" dangerouslySetInnerHTML={{ __html: html }} />
  ) : html === null ? (
    <p className="p-3 text-xs font-semibold text-destructive">Không vẽ được hình SVG</p>
  ) : (
    <div ref={boxRef} className="h-40 animate-pulse bg-muted/40" />
  )

  return (
    <FigureFrame
      view={view}
      code={code ?? <code>{content}</code>}
      rawCode={content}
      getSvg={complete ? () => serializeSvg(boxRef.current) : undefined}
      busy={!complete}
    />
  )
}
