'use client'

import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type N7AiPanelTab = 'docs' | 'tools' | 'notes'

export const SIDEBAR = { min: 220, max: 380, default: 272, rail: 56 }
export const PANEL_MIN = 340
export const CHAT_MIN = 420 // cột chat không hẹp hơn khi kéo panel

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

// Độ rộng panel: mặc định = chia đôi phần bên phải thanh bên; luôn chừa CHAT_MIN cho chat
export function panelWidthFor(stored: number | null, viewport: number, sidebar: number): number {
  const max = Math.max(PANEL_MIN, viewport - sidebar - CHAT_MIN)
  return clamp(Math.round(stored ?? (viewport - sidebar) / 2), PANEL_MIN, max)
}

// localStorage có thể bị chặn (chế độ riêng tư, chặn dữ liệu trang) ⇒ bỏ qua, dùng mặc định
const safeStorage = createJSONStorage(() => ({
  getItem: (key: string) => {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value)
    } catch {
      // bỏ qua
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key)
    } catch {
      // bỏ qua
    }
  }
}))

interface N7AiLayoutState {
  sidebarCollapsed: boolean
  sidebarWidth: number
  panelOpen: boolean
  panelWidth: number | null // null ⇒ chia đôi
  panelTab: N7AiPanelTab
  activeNoteId: string | null
  openNoteId: string | null // ghi chú đang mở trong trình soạn (không lưu)
  appendRequest: { id: string; markdown: string; seq: number } | null
  resizing: boolean
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  setPanelOpen: (open: boolean) => void
  setPanelWidth: (width: number | null) => void
  setPanelTab: (tab: N7AiPanelTab) => void
  setActiveNoteId: (id: string | null) => void
  setOpenNoteId: (id: string | null) => void
  requestAppend: (id: string, markdown: string) => void
  clearAppend: () => void
  setResizing: (resizing: boolean) => void
}

// Bố cục không gian N7AI: thanh bên (thu gọn / kéo giãn) + panel phải (mở / kéo giãn / tab); nhớ theo thiết bị
export const useN7AiLayout = create<N7AiLayoutState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      sidebarWidth: SIDEBAR.default,
      panelOpen: false,
      panelWidth: null,
      panelTab: 'docs',
      activeNoteId: null,
      openNoteId: null,
      appendRequest: null,
      resizing: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarWidth: (width) => set({ sidebarWidth: clamp(Math.round(width), SIDEBAR.min, SIDEBAR.max) }),
      setPanelOpen: (panelOpen) => set({ panelOpen }),
      setPanelWidth: (width) => set({ panelWidth: width === null ? null : Math.max(PANEL_MIN, Math.round(width)) }),
      setPanelTab: (panelTab) => set({ panelTab }),
      setActiveNoteId: (activeNoteId) => set({ activeNoteId }),
      setOpenNoteId: (openNoteId) => set({ openNoteId }),
      requestAppend: (id, markdown) => set((s) => ({ appendRequest: { id, markdown, seq: (s.appendRequest?.seq ?? 0) + 1 } })),
      clearAppend: () => set({ appendRequest: null }),
      setResizing: (resizing) => set({ resizing })
    }),
    {
      name: 'pu:n7ai-layout',
      storage: safeStorage,
      skipHydration: true, // nạp sau khi mount ⇒ HTML server và client khớp nhau
      partialize: ({ sidebarCollapsed, sidebarWidth, panelOpen, panelWidth, panelTab, activeNoteId }) => ({ sidebarCollapsed, sidebarWidth, panelOpen, panelWidth, panelTab, activeNoteId })
    }
  )
)

// Nạp bố cục đã lưu (gọi 1 lần ở khung N7AI)
export function useRestoreN7AiLayout() {
  useEffect(() => {
    void useN7AiLayout.persist.rehydrate()
  }, [])
}

// Ctrl/⌘ + B: thu gọn / mở thanh bên
export function useSidebarShortcut() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'b' || !(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return
      if ((e.target as HTMLElement | null)?.isContentEditable) return
      e.preventDefault()
      useN7AiLayout.getState().toggleSidebar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export function useViewportWidth(): number {
  const [width, setWidth] = useState(1440)
  useEffect(() => {
    const update = () => setWidth(window.innerWidth)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return width
}
