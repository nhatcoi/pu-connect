import React, { useState, useEffect, useRef } from 'react'
import { searchDocs, getCategories, type SearchResult } from '../lib/docs-service'

interface SearchModalProps {
  open: boolean
  onClose: () => void
  onSelect: (slug: string) => void
}

export function SearchModal({ open, onClose, onSelect }: SearchModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const categoryTitle = (id: string) => getCategories().find((c) => c.id === id)?.title ?? ''

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 40)
    }
  }, [open])

  useEffect(() => {
    setResults(searchDocs(query))
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault()
        onSelect(results[selectedIndex].doc.slug)
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, results, selectedIndex, onClose, onSelect])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-16 sm:pt-24">
      <div className="fixed inset-0" onClick={onClose} aria-hidden />
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl">
        <div className="flex items-center border-b border-border px-4">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm module, API, bảng dữ liệu, quy tắc"
            className="w-full bg-transparent py-4 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button onClick={onClose} className="ml-2 text-xs text-muted-foreground hover:text-foreground">
            Esc
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {query.trim() === '' ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nhập từ khóa để tra cứu toàn bộ tài liệu.</p>
          ) : results.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Không tìm thấy kết quả cho &quot;{query}&quot;.</p>
          ) : (
            results.map((item, idx) => (
              <button
                key={item.doc.id}
                onClick={() => {
                  onSelect(item.doc.slug)
                  onClose()
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`block w-full rounded-md px-3 py-2.5 text-left cursor-pointer ${
                  idx === selectedIndex ? 'bg-muted' : ''
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="line-clamp-1 text-sm font-medium text-foreground">{item.doc.title}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{categoryTitle(item.doc.categoryId)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.matchedSnippet}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
