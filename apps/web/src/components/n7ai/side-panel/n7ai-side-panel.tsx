'use client'

import React, { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { create } from 'zustand'
import { ChevronLeft, FileText, PanelRightClose, Sparkles } from 'lucide-react'
import { useFilePreview } from '@/components/viewer/file-preview-panel'
import { cn } from '@/lib/utils'
import { PanelDocs } from './panel-docs'
import { PanelTools } from './panel-tools'

export type N7AiPanelTab = 'docs' | 'tools'

// Panel phải của không gian N7AI: mở / thu gọn + tab đang chọn
export const useN7AiPanel = create<{ open: boolean; tab: N7AiPanelTab; setOpen: (open: boolean) => void; setTab: (tab: N7AiPanelTab) => void }>((set) => ({
  open: false,
  tab: 'docs',
  setOpen: (open) => set({ open }),
  setTab: (tab) => set({ tab })
}))

const TABS: { id: N7AiPanelTab; label: string; icon: typeof FileText }[] = [
  { id: 'docs', label: 'Tài liệu', icon: FileText },
  { id: 'tools', label: 'Công cụ', icon: Sparkles }
]

// Bấm thẻ tệp ở bất kỳ đâu trong N7AI ⇒ mở panel ở tab Tài liệu
export function useOpenPanelOnPreview() {
  const file = useFilePreview((s) => s.file)
  useEffect(() => {
    if (file) useN7AiPanel.setState({ open: true, tab: 'docs' })
  }, [file])
}

// Nút mũi tên giữa mép phải khi panel đang thu gọn (desktop)
export function N7AiPanelToggle() {
  const { open, setOpen } = useN7AiPanel()
  if (open) return null
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Mở panel tài liệu và công cụ"
      className="fixed right-0 top-1/2 z-30 hidden h-14 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-l-xl bg-card text-muted-foreground shadow-sm ring-1 ring-border transition-colors hover:w-7 hover:text-foreground lg:flex"
    >
      <ChevronLeft className="h-4 w-4" />
    </button>
  )
}

// Cột thứ 3 (desktop): tab Tài liệu (danh sách + xem trước) · tab Công cụ (tạo học liệu từ hội thoại / tài liệu)
export function N7AiSidePanel({ className }: { className?: string }) {
  const { tab, setTab, setOpen } = useN7AiPanel()
  const { id: threadId } = useParams<{ id?: string }>()
  return (
    <aside
      data-state="open"
      aria-label="Tài liệu và công cụ"
      className={cn(
        'sticky top-0 h-dvh min-w-0 flex-col border-l border-border/60 bg-surface duration-300 data-[state=open]:animate-in data-[state=open]:slide-in-from-right',
        className
      )}
    >
      <div className="flex h-14 shrink-0 items-center gap-1 border-b border-border/60 px-3" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
              tab === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Thu gọn panel"
          className="ml-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{tab === 'docs' ? <PanelDocs threadId={threadId} /> : <PanelTools threadId={threadId} />}</div>
    </aside>
  )
}
