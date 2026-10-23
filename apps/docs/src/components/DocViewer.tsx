import React, { useMemo, useEffect, useRef } from 'react'
import { Clock, FileCode, ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react'
import type { DocItem } from '../types'
import { renderMarkdown } from '../lib/markdown'
import { MermaidBlock } from './MermaidBlock'
import { getAdjacentDocs } from '../lib/docs-service'

interface DocViewerProps {
  doc: DocItem
  onNavigate: (slug: string) => void
}

interface ContentChunk {
  type: 'html' | 'mermaid'
  content: string
}

export function DocViewer({ doc, onNavigate }: DocViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const { prev, next } = useMemo(() => getAdjacentDocs(doc.slug), [doc.slug])

  // Phân tích nội dung thành các chunk: Markdown HTML vs Mermaid Block
  const chunks = useMemo<ContentChunk[]>(() => {
    const raw = doc.content
    const mermaidRegex = /```mermaid\s*\n([\s\S]*?)```/g
    const result: ContentChunk[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = mermaidRegex.exec(raw)) !== null) {
      const textBefore = raw.substring(lastIndex, match.index)
      if (textBefore.trim()) {
        result.push({ type: 'html', content: renderMarkdown(textBefore) })
      }
      result.push({ type: 'mermaid', content: match[1].trim() })
      lastIndex = mermaidRegex.lastIndex
    }

    const textAfter = raw.substring(lastIndex)
    if (textAfter.trim()) {
      result.push({ type: 'html', content: renderMarkdown(textAfter) })
    }

    return result
  }, [doc.content])

  // Xử lý sự kiện click nút Copy trong các khối mã
  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    const handleCopyClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const button = target.closest('.copy-btn') as HTMLElement
      if (!button) return

      const code = decodeURIComponent(button.getAttribute('data-code') || '')
      if (code) {
        navigator.clipboard.writeText(code)
        const originalText = button.innerText
        button.innerText = 'Đã chép ✓'
        button.classList.add('text-emerald-500', 'border-emerald-500')
        setTimeout(() => {
          button.innerText = originalText
          button.classList.remove('text-emerald-500', 'border-emerald-500')
        }, 2000)
      }
    }

    el.addEventListener('click', handleCopyClick)
    return () => el.removeEventListener('click', handleCopyClick)
  }, [doc.slug])

  // Tính thời gian đọc ước tính
  const readTimeMinutes = useMemo(() => {
    const words = doc.content.split(/\s+/).length
    return Math.max(1, Math.round(words / 200))
  }, [doc.content])

  return (
    <article className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header tài liệu */}
      <div className="pb-6 mb-8 border-b border-border">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            {doc.categoryId === 'core'
              ? 'Kiến trúc Cốt lõi (ADR)'
              : doc.categoryId === 'diagrams'
                ? 'Sơ đồ Hệ thống (C4)'
                : doc.categoryId === 'api-db'
                  ? 'Đặc tả API & Schema'
                  : doc.categoryId === 'guides'
                    ? 'Hướng dẫn Vận hành'
                    : 'Tổng quan & Bắt đầu'}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {readTimeMinutes} phút đọc
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
            <FileCode className="h-3.5 w-3.5" />
            docs/{doc.relPath}
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
          {doc.title}
        </h1>

        {doc.summary && (
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed italic border-l-2 border-primary/50 pl-3">
            {doc.summary}
          </p>
        )}
      </div>

      {/* Nội dung bài viết */}
      <div ref={contentRef} className="doc-prose">
        {chunks.map((chunk, idx) => {
          if (chunk.type === 'mermaid') {
            return <MermaidBlock key={`mermaid-${idx}`} code={chunk.content} />
          }
          return <div key={`html-${idx}`} dangerouslySetInnerHTML={{ __html: chunk.content }} />
        })}
      </div>

      {/* Điều hướng Trước / Sau */}
      <div className="mt-14 pt-8 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4">
        {prev ? (
          <button
            onClick={() => {
              onNavigate(prev.slug)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="group flex flex-col p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-all text-left"
          >
            <span className="text-xs text-muted-foreground flex items-center gap-1 mb-1 group-hover:text-primary transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Bài trước
            </span>
            <span className="font-semibold text-sm text-foreground line-clamp-1">{prev.title}</span>
          </button>
        ) : (
          <div />
        )}

        {next && (
          <button
            onClick={() => {
              onNavigate(next.slug)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="group flex flex-col p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-all text-right items-end sm:col-start-2"
          >
            <span className="text-xs text-muted-foreground flex items-center gap-1 mb-1 group-hover:text-primary transition-colors">
              Bài tiếp theo <ArrowRight className="h-3.5 w-3.5" />
            </span>
            <span className="font-semibold text-sm text-foreground line-clamp-1">{next.title}</span>
          </button>
        )}
      </div>

      {/* Footer bản quyền & liên kết */}
      <div className="mt-12 pt-6 border-t border-border/50 flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-4">
        <div>PU Connector Architecture & Developer Documentation © {new Date().getFullYear()} Phenikaa University</div>
        <div className="flex items-center gap-4">
          <a
            href="https://puc.vnhat.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            Mở PU Connector Web <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://admin-puc.vnhat.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            Admin Console <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </article>
  )
}
