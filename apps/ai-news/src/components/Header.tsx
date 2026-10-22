import React from 'react'
import { Globe, Moon, Newspaper, Settings, Sun } from 'lucide-react'

export function Header({
  darkMode,
  onToggleDark,
  onOpenConfig
}: {
  darkMode: boolean
  onToggleDark: () => void
  onOpenConfig: () => void
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Newspaper className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-foreground">AI News Hub</span>
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                ai-news.vnhat.dev
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Công cụ thu thập & tóm tắt tin tức đa lĩnh vực bằng AI</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleDark}
            className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            title="Đổi giao diện Sáng / Tối"
          >
            {darkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>

          <button
            type="button"
            onClick={onOpenConfig}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted hover:border-border/80 transition-colors cursor-pointer shadow-xs"
          >
            <Settings className="size-4 text-primary" />
            <span className="hidden sm:inline">Cấu hình LLM & Tele</span>
          </button>
        </div>
      </div>
    </header>
  )
}
