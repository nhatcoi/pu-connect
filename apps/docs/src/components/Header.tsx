import React from 'react'
import { Search, Menu, ExternalLink, Sparkles } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'

interface HeaderProps {
  onOpenSearch: () => void
  onToggleMobileMenu: () => void
  onGoHome: () => void
}

export function Header({ onOpenSearch, onToggleMobileMenu, onGoHome }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="w-full flex h-14 items-center justify-between px-4 sm:px-6">
        {/* Left: Hamburger & Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobileMenu}
            aria-label="Mở danh mục tài liệu"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <button
            onClick={onGoHome}
            className="flex items-center gap-2.5 text-left group cursor-pointer"
          >
            <img src="/brand/pu-mark.svg" alt="PU Connector" className="h-7 w-7 transition-transform group-hover:scale-105" />
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-foreground">PU Connector</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold border border-primary/20">
                Docs
              </span>
            </div>
          </button>
        </div>

        {/* Center: Search Button (Cmd+K) */}
        <div className="flex-1 max-w-md mx-4 hidden sm:block">
          <button
            onClick={onOpenSearch}
            className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-xl border border-border bg-muted/50 hover:bg-muted text-xs text-muted-foreground hover:text-foreground transition-all group"
          >
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 group-hover:text-primary transition-colors" />
              <span>Tìm kiếm tài liệu, sơ đồ, API...</span>
            </div>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-background border border-border rounded shadow-2xs">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right: Search Mobile + Ecosystem Links + Theme */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={onOpenSearch}
            aria-label="Tìm kiếm"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted sm:hidden"
          >
            <Search className="h-5 w-5" />
          </button>

          <div className="hidden md:flex items-center gap-2 pr-2 border-r border-border text-xs">
            <a
              href="https://puc.vnhat.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1"
            >
              <span>PUC Web</span>
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
            <a
              href="https://admin-puc.vnhat.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1"
            >
              <span>Admin</span>
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
            <a
              href="https://puc.vnhat.dev/n7ai"
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-lg font-medium text-brand-orange hover:bg-brand-orange/10 transition-colors flex items-center gap-1"
            >
              <Sparkles className="h-3 w-3" />
              <span>N7AI</span>
            </a>
          </div>

          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
