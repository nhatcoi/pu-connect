import React, { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { Maximize2, Minimize2, Copy, Check, Code, Eye, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  theme: 'neutral',
  fontFamily: 'Inter, sans-serif'
})

interface MermaidBlockProps {
  code: string
  title?: string
}

export function MermaidBlock({ code, title }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svgHtml, setSvgHtml] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [showCode, setShowCode] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    let isMounted = true
    const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`

    // Detect theme
    const isDark = document.documentElement.classList.contains('dark')
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'default',
      themeVariables: isDark
        ? {
            darkMode: true,
            background: '#0f172a',
            primaryColor: '#0284c7',
            primaryTextColor: '#f8fafc',
            primaryBorderColor: '#38bdf8',
            lineColor: '#94a3b8',
            secondaryColor: '#1e293b',
            tertiaryColor: '#131d33'
          }
        : {
            darkMode: false,
            primaryColor: '#0b3d91',
            primaryTextColor: '#ffffff',
            primaryBorderColor: '#0b3d91',
            lineColor: '#64748b'
          }
    })

    mermaid
      .render(id, code)
      .then(({ svg }) => {
        if (isMounted) {
          setSvgHtml(svg)
          setError(null)
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Lỗi render Mermaid:', err)
          setError(err?.message || 'Không thể hiển thị sơ đồ Mermaid.')
        }
      })

    return () => {
      isMounted = false
    }
  }, [code])

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <div className="my-6 rounded-2xl border border-border bg-card/60 backdrop-blur-xs shadow-sm overflow-hidden transition-all duration-200 hover:border-primary/40">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30 text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <span className="font-semibold text-foreground">{title || 'Sơ đồ tương tác (Mermaid)'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowCode(!showCode)}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 text-xs"
              title={showCode ? 'Xem sơ đồ đồ họa' : 'Xem mã Mermaid'}
            >
              {showCode ? <Eye className="h-3.5 w-3.5" /> : <Code className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{showCode ? 'Đồ họa' : 'Mã nguồn'}</span>
            </button>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 text-xs"
              title="Sao chép mã Mermaid"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Đã chép' : 'Chép mã'}</span>
            </button>
            <button
              onClick={() => setIsFullscreen(true)}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 text-xs"
              title="Phóng to toàn màn hình"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Toàn màn hình</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-x-auto min-h-[140px] flex items-center justify-center bg-surface/50">
          {showCode ? (
            <pre className="w-full text-xs font-mono p-4 rounded-xl bg-[#090d16] text-slate-100 overflow-x-auto">
              <code>{code}</code>
            </pre>
          ) : error ? (
            <div className="text-center p-6 text-sm text-red-500">
              <p className="font-medium">Không thể dựng sơ đồ Mermaid</p>
              <p className="text-xs text-muted-foreground mt-1 font-mono">{error}</p>
              <pre className="mt-3 text-left text-xs bg-muted p-3 rounded-lg overflow-x-auto font-mono text-foreground">
                {code}
              </pre>
            </div>
          ) : svgHtml ? (
            <div
              ref={containerRef}
              className="mermaid-svg-container w-full flex justify-center [&>svg]:max-w-full [&>svg]:h-auto transition-transform"
              dangerouslySetInnerHTML={{ __html: svgHtml }}
            />
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-8">
              <span className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              Đang vẽ sơ đồ...
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">{title || 'Sơ đồ hệ thống PU Connect'}</span>
              <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-lg text-xs">
                <button
                  onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}
                  className="p-1 hover:bg-background rounded"
                  title="Thu nhỏ"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="px-1.5 font-mono">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
                  className="p-1 hover:bg-background rounded"
                  title="Phóng to"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setZoom(1)}
                  className="p-1 hover:bg-background rounded ml-1"
                  title="Đặt lại zoom"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                setIsFullscreen(false)
                setZoom(1)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-xs font-medium transition-colors"
            >
              <Minimize2 className="h-4 w-4" />
              <span>Đóng</span>
            </button>
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center p-6">
            <div
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
              className="transition-transform duration-150 max-w-none flex justify-center [&>svg]:max-w-none [&>svg]:h-auto"
              dangerouslySetInnerHTML={{ __html: svgHtml }}
            />
          </div>
        </div>
      )}
    </>
  )
}
