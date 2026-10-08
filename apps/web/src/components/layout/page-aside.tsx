'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// Slot cột phải của layout chung: trang nào cần cột riêng (search, cộng đồng) render <PageAside>,
// nếu không layout hiện RightSidebar mặc định
interface AsideSlotValue {
  node: HTMLElement | null
  register: () => () => void
}

const AsideSlotContext = createContext<AsideSlotValue | null>(null)

export function AsideSlotProvider({
  node,
  onCustomChange,
  children
}: {
  node: HTMLElement | null
  onCustomChange: (count: number) => void
  children: React.ReactNode
}) {
  const [count, setCount] = useState(0)
  useEffect(() => onCustomChange(count), [count, onCustomChange])
  const register = React.useCallback(() => {
    setCount((c) => c + 1)
    return () => setCount((c) => c - 1)
  }, [])
  const value = React.useMemo(() => ({ node, register }), [node, register])
  return <AsideSlotContext.Provider value={value}>{children}</AsideSlotContext.Provider>
}

export function PageAside({ children }: { children: React.ReactNode }) {
  const ctx = useContext(AsideSlotContext)
  const register = ctx?.register
  useEffect(() => register?.(), [register])
  if (!ctx?.node) return null
  return createPortal(children, ctx.node)
}
