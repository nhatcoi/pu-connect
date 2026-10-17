import { useCallback, useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'
const KEY = 'puc-admin-theme'

function read(): ThemeMode {
  try {
    const t = localStorage.getItem(KEY)
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch {
    return 'system'
  }
}

function isDark(mode: ThemeMode) {
  return mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
}

// Theme sáng/tối/hệ thống (đồng bộ class .dark trên <html>)
export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(read)
  const [dark, setDark] = useState(() => isDark(read()))

  useEffect(() => {
    const apply = () => {
      const d = isDark(mode)
      document.documentElement.classList.toggle('dark', d)
      setDark(d)
    }
    apply()
    if (mode !== 'system') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [mode])

  const setMode = useCallback((m: ThemeMode) => {
    try {
      localStorage.setItem(KEY, m)
    } catch {
      // ignore
    }
    setModeState(m)
  }, [])

  return { mode, dark, setMode }
}
