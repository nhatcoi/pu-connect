'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Check, Code2, Copy, Download, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Giá trị cập nhật tối đa mỗi `ms` (đầu + cuối) ⇒ hình vẽ dần theo stream mà không dựng lại theo từng token. */
export function useThrottledValue<T>(value: T, ms = 140): T {
  const [out, setOut] = useState(value)
  const last = useRef(0)
  useEffect(() => {
    const wait = Math.max(0, last.current + ms - Date.now())
    const t = setTimeout(() => {
      last.current = Date.now()
      setOut(value)
    }, wait)
    return () => clearTimeout(t)
  }, [value, ms])
  return out
}

function saveText(text: string, name: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** Lấy SVG đang hiển thị trong khung (nếu có) để tải về. */
export function serializeSvg(root: ParentNode | null): string | null {
  const svg = root?.querySelector('svg')
  if (!svg) return null
  const clone = svg.cloneNode(true) as SVGSVGElement
  if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  return new XMLSerializer().serializeToString(clone)
}

/**
 * Khung chung cho hình do AI tạo (SVG, đồ thị, Mermaid): tab Hình / Mã, sao chép mã, tải .svg.
 * `view` luôn được dựng (kể cả đang ở tab Mã) để hình giữ nguyên trạng thái khi đổi tab.
 */
export function FigureFrame({
  view,
  code,
  rawCode,
  fileName = 'hinh.svg',
  getSvg,
  getDownload,
  busy
}: {
  view: React.ReactNode
  code: React.ReactNode
  rawCode: string
  fileName?: string
  getSvg?: () => string | null
  getDownload?: () => { text: string; name: string; mime: string } | null // tải dạng khác SVG (vd. CSV)
  busy?: boolean
}) {
  const [tab, setTab] = useState<'view' | 'code'>('view')
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(rawCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  const download = () => {
    const file = getDownload?.()
    if (file) return saveText(file.text, file.name, file.mime)
    const svg = getSvg?.()
    if (svg) saveText(svg, fileName, 'image/svg+xml')
  }

  const tabBtn = (id: 'view' | 'code', label: string, Icon: typeof Eye) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      title={label}
      aria-label={label}
      aria-pressed={tab === id}
      className={cn('inline-flex h-6 w-7 items-center justify-center rounded transition-colors', tab === id ? 'bg-background text-foreground shadow-xs' : 'hover:text-foreground')}
    >
      <Icon className="size-3.5" />
    </button>
  )
  const iconBtn = 'inline-flex h-6 items-center gap-1 rounded px-1.5 hover:bg-background hover:text-foreground'

  return (
    <div className="my-4 overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 rounded-md bg-muted p-0.5">
            {tabBtn('view', 'Hình', Eye)}
            {tabBtn('code', 'Mã', Code2)}
          </div>
          {busy && <span className="animate-pulse text-[11px]">Đang vẽ…</span>}
        </div>
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={copy} className={iconBtn} aria-label="Sao chép mã">
            {copied ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
          </button>
          {(getSvg || getDownload) && (
            <button type="button" onClick={download} className={iconBtn} aria-label="Tải .svg">
              <Download className="size-3" />
            </button>
          )}
        </div>
      </div>
      <div className={tab === 'view' ? '' : 'hidden'}>{view}</div>
      {tab === 'code' && <pre className="max-h-[480px] overflow-auto p-3 font-mono text-sm">{code}</pre>}
    </div>
  )
}
