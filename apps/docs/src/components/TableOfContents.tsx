import React, { useEffect, useState } from 'react'
import type { DocHeading } from '../types'
import { AlignLeft, ExternalLink, Sparkles } from 'lucide-react'

interface TableOfContentsProps {
  headings: DocHeading[]
}

export function TableOfContents({ headings }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    if (headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
            break
          }
        }
      },
      { rootMargin: '-80px 0% -60% 0%' }
    )

    headings.forEach((h) => {
      const el = document.getElementById(h.id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [headings])

  if (headings.length === 0) {
    return null
  }

  return (
    <aside className="w-64 shrink-0 hidden xl:block sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto py-8 pr-4 text-xs">
      <div className="flex items-center gap-2 font-semibold text-foreground mb-3 uppercase tracking-wider text-[11px]">
        <AlignLeft className="h-3.5 w-3.5 text-primary" />
        Mục lục trang này
      </div>

      <nav className="space-y-1 border-l border-border pl-3">
        {headings.map((heading) => {
          const isActive = activeId === heading.id
          return (
            <a
              key={heading.id}
              href={`#${heading.id}`}
              onClick={(e) => {
                e.preventDefault()
                const el = document.getElementById(heading.id)
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth' })
                  setActiveId(heading.id)
                  history.pushState(null, '', `#${heading.id}`)
                }
              }}
              className={`block py-1 transition-colors leading-snug line-clamp-2 ${
                heading.level === 3 ? 'pl-3 text-[11px]' : 'font-medium'
              } ${
                isActive
                  ? 'text-primary font-semibold -ml-[13px] border-l-2 border-primary pl-3'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {heading.text}
            </a>
          )
        })}
      </nav>

      <div className="mt-8 pt-6 border-t border-border space-y-2.5">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Hệ sinh thái PU
        </div>
        <a
          href="https://puc.vnhat.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between py-1 text-muted-foreground hover:text-primary transition-colors"
        >
          <span>Mạng xã hội PUC</span>
          <ExternalLink className="h-3 w-3" />
        </a>
        <a
          href="https://admin-puc.vnhat.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between py-1 text-muted-foreground hover:text-primary transition-colors"
        >
          <span>Admin Console</span>
          <ExternalLink className="h-3 w-3" />
        </a>
        <a
          href="https://puc.vnhat.dev/n7ai"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between py-1 text-muted-foreground hover:text-primary transition-colors"
        >
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-brand-orange" /> Trợ lý N7AI
          </span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </aside>
  )
}
