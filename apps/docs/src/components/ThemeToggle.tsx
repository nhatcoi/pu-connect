import React, { useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

const LABELS: Record<Theme, string> = { light: 'Sáng', dark: 'Tối', system: 'Hệ thống' }

function applyTheme(mode: Theme) {
  const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')

  useEffect(() => {
    let saved: Theme = 'system'
    try {
      saved = (localStorage.getItem('puc-docs-theme') as Theme) || 'system'
    } catch {
      // trình duyệt chặn lưu trữ: dùng mặc định
    }
    setTheme(saved)
    applyTheme(saved)
  }, [])

  const cycle = () => {
    const next: Theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
    setTheme(next)
    try {
      localStorage.setItem('puc-docs-theme', next)
    } catch {
      // bỏ qua
    }
    applyTheme(next)
  }

  return (
    <button
      onClick={cycle}
      aria-label="Đổi giao diện sáng, tối"
      className="ml-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
    >
      {LABELS[theme]}
    </button>
  )
}
