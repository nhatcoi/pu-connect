'use client'

import React, { useMemo } from 'react'
import DOMPurify from 'dompurify'

/**
 * Hình SVG do AI vẽ: nhúng trực tiếp (không <img>) để dùng lớp màu theo sáng/tối của app (xem .svg-figure trong globals.css).
 * DOMPurify bỏ script / onclick; chuỗi hỏng không crash trang, hiện khung lỗi.
 */
export function SvgBlock({ content }: { content: string }) {
  const html = useMemo(() => {
    if (!/<svg[\s>]/.test(content)) return null
    return DOMPurify.sanitize(content, { USE_PROFILES: { svg: true, svgFilters: true } })
  }, [content])

  if (!html) {
    return (
      <div className="my-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
        <p className="font-semibold">Không vẽ được hình SVG.</p>
      </div>
    )
  }
  return <div className="svg-figure my-4 flex justify-center overflow-x-auto rounded-lg border bg-card p-4 shadow-xs" dangerouslySetInnerHTML={{ __html: html }} />
}
