import React, { useState } from 'react'
import type { DocCategory, DocItem } from '../types'
import {
  Rocket,
  Layers,
  GitFork,
  Database,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Filter,
  X
} from 'lucide-react'

interface SidebarProps {
  categories: DocCategory[]
  docs: DocItem[]
  activeSlug: string
  onSelect: (slug: string) => void
  isOpenMobile?: boolean
  onCloseMobile?: () => void
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  overview: <Rocket className="h-4 w-4 text-sky-500" />,
  core: <Layers className="h-4 w-4 text-purple-500" />,
  diagrams: <GitFork className="h-4 w-4 text-amber-500" />,
  'api-db': <Database className="h-4 w-4 text-emerald-500" />,
  guides: <BookOpen className="h-4 w-4 text-rose-500" />
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
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})

  const toggleCategory = (catId: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }))
  }

  // Filter docs
  const filteredDocs = docs.filter((d) => {
    if (!filterText.trim()) return true
    const term = filterText.toLowerCase()
    return d.title.toLowerCase().includes(term) || d.slug.toLowerCase().includes(term)
  })

  const sidebarContent = (
    <div className="flex flex-col h-full bg-surface border-r border-border select-none">
      {/* Mobile Header */}
      <div className="flex lg:hidden items-center justify-between p-4 border-b border-border">
        <span className="font-bold text-sm text-foreground">Danh mục Tài liệu</span>
        {onCloseMobile && (
          <button onClick={onCloseMobile} className="p-1 rounded-md text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Quick Filter Input */}
      <div className="p-3 border-b border-border/60">
        <div className="relative">
          <Filter className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Lọc tài liệu nhanh..."
            className="w-full pl-8 pr-3 py-1.5 bg-background rounded-lg text-xs border border-border/80 placeholder:text-muted-foreground outline-none focus:border-primary"
          />
          {filterText && (
            <button
              onClick={() => setFilterText('')}
              className="absolute right-2 top-2 p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Accordion Categories & Docs */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
        {categories.map((cat) => {
          const categoryDocs = filteredDocs.filter((d) => d.categoryId === cat.id)
          if (filterText && categoryDocs.length === 0) return null

          const isCollapsed = collapsedCategories[cat.id]

          return (
            <div key={cat.id} className="space-y-1">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(cat.id)}
                className="w-full flex items-center justify-between py-1 px-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                  {CATEGORY_ICONS[cat.id] || <Layers className="h-4 w-4" />}
                  <span>{cat.title}</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    ({categoryDocs.length})
                  </span>
                </div>
                <div className="text-muted-foreground group-hover:text-foreground">
                  {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </div>
              </button>

              {/* Doc List */}
              {!isCollapsed && (
                <div className="pl-3 space-y-0.5 border-l border-border/60 ml-2 mt-1">
                  {categoryDocs.map((doc) => {
                    const isActive = activeSlug === doc.slug || activeSlug === doc.id
                    return (
                      <button
                        key={doc.id}
                        onClick={() => {
                          onSelect(doc.slug)
                          if (onCloseMobile) onCloseMobile()
                        }}
                        className={`w-full text-left py-1.5 px-2.5 rounded-lg transition-all flex items-center justify-between group cursor-pointer ${
                          isActive
                            ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                        }`}
                      >
                        <span className="line-clamp-1 leading-relaxed text-xs">
                          {doc.title.replace(/^#\s*/, '')}
                        </span>
                        {doc.hasMermaid && (
                          <span
                            className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-mono shrink-0 ml-1.5 ${
                              isActive
                                ? 'bg-white/20 text-white'
                                : 'bg-muted text-muted-foreground group-hover:bg-muted-foreground/20'
                            }`}
                          >
                            Mermaid
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="w-72 shrink-0 hidden lg:block sticky top-14 h-[calc(100vh-3.5rem)]">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={onCloseMobile} />
          <div className="relative w-80 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  )
}
