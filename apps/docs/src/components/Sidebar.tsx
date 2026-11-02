import React, { useState } from 'react'
import type { DocCategory, DocItem } from '../types'

interface SidebarProps {
  categories: DocCategory[]
  docs: DocItem[]
  activeSlug: string
  onSelect: (slug: string) => void
  isOpenMobile?: boolean
  onCloseMobile?: () => void
}

function stripNumbering(title: string) {
  return title.replace(/^\d+\s*[—–.-]\s*/, '')
}

export function Sidebar({
  categories,
  docs,
  activeSlug,
  onSelect,
  isOpenMobile = false,
  onCloseMobile
}: SidebarProps) {
  const [filterText, setFilterText] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const term = filterText.trim().toLowerCase()
  const filtered = docs.filter(
    (d) => !term || d.title.toLowerCase().includes(term) || d.slug.toLowerCase().includes(term)
  )

  const content = (
    <div className="flex h-full flex-col border-r border-border bg-background">
      <div className="flex items-center justify-between border-b border-border p-4 lg:hidden">
        <span className="text-sm font-semibold text-foreground">Danh mục</span>
        {onCloseMobile && (
          <button onClick={onCloseMobile} className="text-sm text-muted-foreground hover:text-foreground">
            Đóng
          </button>
        )}
      </div>

      <div className="p-3">
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Lọc theo tên"
          className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
        />
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-8 text-sm">
        {categories.map((cat) => {
          const items = filtered.filter((d) => d.categoryId === cat.id)
          if (items.length === 0) return null
          const isCollapsed = !term && collapsed[cat.id]

          return (
            <section key={cat.id}>
              <button
                onClick={() => setCollapsed((p) => ({ ...p, [cat.id]: !p[cat.id] }))}
                className="flex w-full items-baseline justify-between px-2 py-1 text-left cursor-pointer"
                aria-expanded={!isCollapsed}
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">{cat.title}</span>
                <span className="text-[11px] text-muted-foreground">{isCollapsed ? 'Mở' : items.length}</span>
              </button>
              {!isCollapsed && (
                <ul className="mt-1 space-y-px">
                  {items.map((doc) => {
                    const isActive = activeSlug === doc.slug
                    return (
                      <li key={doc.id}>
                        <button
                          onClick={() => {
                            onSelect(doc.slug)
                            onCloseMobile?.()
                          }}
                          aria-current={isActive ? 'page' : undefined}
                          className={`block w-full rounded-md border-l-2 px-2.5 py-1.5 text-left leading-snug transition-colors cursor-pointer ${
                            isActive
                              ? 'border-primary bg-muted font-medium text-foreground'
                              : 'border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                          }`}
                        >
                          {stripNumbering(doc.title)}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
        {filtered.length === 0 && <p className="px-2 text-muted-foreground">Không có tài liệu phù hợp.</p>}
      </nav>
    </div>
  )

  return (
    <>
      <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-72 shrink-0 lg:block">{content}</aside>

      {isOpenMobile && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={onCloseMobile} />
          <div className="relative z-10 h-full w-80 max-w-[85vw] shadow-2xl">{content}</div>
        </div>
      )}
    </>
  )
}
