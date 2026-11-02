import React from 'react'
import { ThemeToggle } from './ThemeToggle'

interface HeaderProps {
  onOpenSearch: () => void
  onToggleMobileMenu: () => void
  onGoHome: () => void
}

const LINKS = [
  { label: 'PUC Web', href: 'https://puc.vnhat.dev' },
  { label: 'N7AI', href: 'https://puc.vnhat.dev/n7ai' },
  { label: 'Admin', href: 'https://admin-puc.vnhat.dev' }
]

export function Header({ onOpenSearch, onToggleMobileMenu, onGoHome }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-4 px-4 sm:px-6">
        <button
          onClick={onToggleMobileMenu}
          aria-label="Mở danh mục tài liệu"
          className="lg:hidden rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Menu
        </button>

        <button onClick={onGoHome} className="flex items-center gap-2.5 text-left cursor-pointer">
          <img src="/brand/pu-mark.svg" alt="" className="h-6 w-6" />
          <span className="text-sm font-semibold tracking-tight text-foreground">PU Connect</span>
          <span className="hidden sm:inline text-sm text-muted-foreground">Tài liệu</span>
        </button>

        <div className="mx-auto hidden w-full max-w-md sm:block">
          <button
            onClick={onOpenSearch}
            className="flex w-full items-center justify-between rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <span>Tìm trong tài liệu</span>
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">Ctrl K</kbd>
          </button>
        </div>

        <nav className="ml-auto flex items-center gap-1 text-sm">
          <button
            onClick={onOpenSearch}
            className="sm:hidden rounded-md px-2.5 py-1.5 text-muted-foreground hover:text-foreground"
          >
            Tìm
          </button>
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
