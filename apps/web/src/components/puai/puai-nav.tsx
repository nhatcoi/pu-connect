'use client'

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'

// Ngăn lịch sử PU AI trên mobile: trang con mở bằng nút ☰, tự đóng khi chuyển trang
interface PuaiNavValue {
  open: boolean
  setOpen: (open: boolean) => void
  openNav: () => void
}

const PuaiNavContext = createContext<PuaiNavValue | null>(null)

export function PuaiNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  useEffect(() => setOpen(false), [pathname])
  const value = useMemo(() => ({ open, setOpen, openNav: () => setOpen(true) }), [open])
  return <PuaiNavContext.Provider value={value}>{children}</PuaiNavContext.Provider>
}

export function usePuaiNav(): PuaiNavValue {
  const ctx = useContext(PuaiNavContext)
  if (!ctx) throw new Error('usePuaiNav must be used inside PuaiNavProvider')
  return ctx
}
