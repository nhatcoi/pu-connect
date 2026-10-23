import React, { useEffect, useState } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')

  useEffect(() => {
    const saved = (localStorage.getItem('puc-docs-theme') as 'light' | 'dark' | 'system') || 'system'
    setTheme(saved)
    applyTheme(saved)
  }, [])

  const applyTheme = (mode: 'light' | 'dark' | 'system') => {
    const isDark =
      mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const cycleTheme = () => {
    const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
    setTheme(next)
    localStorage.setItem('puc-docs-theme', next)
    applyTheme(next)
  }

  return (
    <button
      onClick={cycleTheme}
      aria-label="Đổi giao diện Sáng / Tối"
      title={`Giao diện: ${theme === 'dark' ? 'Tối' : theme === 'light' ? 'Sáng' : 'Theo hệ thống'}`}
      className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors flex items-center justify-center cursor-pointer"
    >
      {theme === 'dark' ? (
        <Moon className="h-4 w-4 text-sky-400" />
      ) : theme === 'light' ? (
        <Sun className="h-4 w-4 text-amber-500" />
      ) : (
        <Monitor className="h-4 w-4" />
      )}
    </button>
  )
}
