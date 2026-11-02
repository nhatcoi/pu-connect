import React, { useEffect, useState } from 'react'
import type { DocHeading } from '../types'

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

  if (headings.length === 0) return null

  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto py-8 pr-4 text-sm xl:block">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-foreground">Trong trang này</div>
      <nav className="space-y-0.5 border-l border-border">
        {headings.map((h) => {
          const isActive = activeId === h.id
          return (
            <a
              key={h.id}
              href={`#${h.id}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' })
                setActiveId(h.id)
              }}
              className={`-ml-px block border-l-2 py-1 leading-snug transition-colors ${
                h.level === 3 ? 'pl-6 text-xs' : 'pl-3'
              } ${
                isActive
                  ? 'border-primary font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {h.text}
            </a>
          )
        })}
      </nav>
    </aside>
  )
}
