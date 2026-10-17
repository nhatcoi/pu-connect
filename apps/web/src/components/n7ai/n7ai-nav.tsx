'use client'

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'

// Ngăn lịch sử N7AI trên mobile: trang con mở bằng nút ☰, tự đóng khi chuyển trang
interface N7AiNavValue {
  open: boolean
  setOpen: (open: boolean) => void
  openNav: () => void
}

const N7AiNavContext = createContext<N7AiNavValue | null>(null)

export function N7AiNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  useEffect(() => setOpen(false), [pathname])
  const value = useMemo(() => ({ open, setOpen, openNav: () => setOpen(true) }), [open])
  return <N7AiNavContext.Provider value={value}>{children}</N7AiNavContext.Provider>
}

export function useN7AiNav(): N7AiNavValue {
  const ctx = useContext(N7AiNavContext)
  if (!ctx) throw new Error('useN7AiNav must be used inside N7AiNavProvider')
  return ctx
}
