import React, { useMemo, useEffect, useRef } from 'react'
import type { DocItem } from '../types'
import { renderMarkdown, resetHeadingIds } from '../lib/markdown'
import { MermaidBlock } from './MermaidBlock'
import { getAdjacentDocs, getCategories, getDocBySlug } from '../lib/docs-service'

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
  const categoryTitle = useMemo(
    () => getCategories().find((c) => c.id === doc.categoryId)?.title ?? '',
    [doc.categoryId]
  )

  // Tách nội dung thành khối Markdown và khối sơ đồ Mermaid
  const chunks = useMemo<ContentChunk[]>(() => {
    resetHeadingIds()
    // Tiêu đề h1 đã hiển thị ở phần đầu trang
    const raw = doc.content.replace(/^\s*#\s+.+\n?/, '')
    const mermaidRegex = /```mermaid\s*\n([\s\S]*?)```/g
    const result: ContentChunk[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = mermaidRegex.exec(raw)) !== null) {
      const before = raw.substring(lastIndex, match.index)
      if (before.trim()) result.push({ type: 'html', content: renderMarkdown(before) })
      result.push({ type: 'mermaid', content: match[1].trim() })
      lastIndex = mermaidRegex.lastIndex
    }
    const after = raw.substring(lastIndex)
    if (after.trim()) result.push({ type: 'html', content: renderMarkdown(after) })
    return result
  }, [doc.content])

  // Sao chép mã và điều hướng liên kết nội bộ
  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement

      const copyBtn = target.closest('.copy-btn') as HTMLElement | null
      if (copyBtn) {
        const code = decodeURIComponent(copyBtn.getAttribute('data-code') || '')
        if (code) {
          navigator.clipboard.writeText(code)
          const original = copyBtn.innerText
          copyBtn.innerText = 'Đã chép'
          setTimeout(() => {
            copyBtn.innerText = original
          }, 1600)
        }
        return
      }

      const anchor = target.closest('a') as HTMLAnchorElement | null
      const href = anchor?.getAttribute('href')
      if (!anchor || !href || !href.startsWith('#')) return
      e.preventDefault()
      const key = decodeURIComponent(href.slice(1))
      if (getDocBySlug(key)?.slug === key) {
        onNavigate(key)
      } else {
        document.getElementById(key)?.scrollIntoView({ behavior: 'smooth' })
      }
    }

    el.addEventListener('click', handleClick)
    return () => el.removeEventListener('click', handleClick)
  }, [doc.slug, onNavigate])

  const readTimeMinutes = useMemo(
    () => Math.max(1, Math.round(doc.content.split(/\s+/).length / 220)),
    [doc.content]
  )

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-border pb-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {categoryTitle}
          <span className="mx-2">/</span>
          {readTimeMinutes} phút đọc
        </p>
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground">{doc.title}</h1>
      </header>

      <div ref={contentRef} className="doc-prose">
        {chunks.map((chunk, idx) =>
          chunk.type === 'mermaid' ? (
            <MermaidBlock key={`mermaid-${idx}`} code={chunk.content} />
          ) : (
            <div key={`html-${idx}`} dangerouslySetInnerHTML={{ __html: chunk.content }} />
          )
        )}
      </div>

      <nav className="mt-14 grid grid-cols-1 gap-3 border-t border-border pt-8 sm:grid-cols-2">
        {prev ? (
          <button
            onClick={() => onNavigate(prev.slug)}
            className="rounded-md border border-border p-4 text-left transition-colors hover:border-primary cursor-pointer"
          >
            <span className="block text-xs text-muted-foreground">Trước</span>
            <span className="mt-1 block line-clamp-1 text-sm font-medium text-foreground">{prev.title}</span>
          </button>
        ) : (
          <div />
        )}
        {next && (
          <button
            onClick={() => onNavigate(next.slug)}
            className="rounded-md border border-border p-4 text-right transition-colors hover:border-primary sm:col-start-2 cursor-pointer"
          >
            <span className="block text-xs text-muted-foreground">Tiếp</span>
            <span className="mt-1 block line-clamp-1 text-sm font-medium text-foreground">{next.title}</span>
          </button>
        )}
      </nav>

      <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground">
        <span>PU Connect, Trường Đại học Phenikaa</span>
        <span className="font-mono">docs/{doc.relPath}</span>
      </footer>
    </article>
  )
}
