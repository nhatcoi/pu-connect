'use client'

import React, { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { ChevronLeft, FileText, PanelRight, PanelRightClose, Sparkles } from 'lucide-react'
import { useFilePreview } from '@/components/viewer/file-preview-panel'
import { useSourceView } from '../sources/source-view-store'
import { cn } from '@/lib/utils'
import { useN7AiLayout, type N7AiPanelTab } from '../layout/n7ai-layout-store'
import { PanelDocs } from './panel-docs'
import { PanelTools } from './panel-tools'

const TABS: { id: N7AiPanelTab; label: string; icon: typeof FileText }[] = [
  { id: 'docs', label: 'Tài liệu', icon: FileText },
  { id: 'tools', label: 'Công cụ', icon: Sparkles }
]

// Bấm thẻ tệp ở bất kỳ đâu trong N7AI ⇒ mở panel ở tab Tài liệu
export function useOpenPanelOnPreview() {
  // seq tăng mỗi lần bấm thẻ tệp / tài liệu (kể cả cùng tài liệu) ⇒ đóng panel rồi bấm lại vẫn mở
  const fileSeq = useFilePreview((s) => s.seq)
  const sourceSeq = useSourceView((s) => s.seq)
  useEffect(() => {
    if (fileSeq + sourceSeq > 0) useN7AiLayout.setState({ panelOpen: true, panelTab: 'docs' })
  }, [fileSeq, sourceSeq])
  // Rời không gian N7AI ⇒ đóng tài liệu chữ đang xem (tệp do useFilePreviewHost đóng)
  useEffect(() => () => useSourceView.getState().close(), [])
}

// Nút mũi tên giữa mép phải khi panel đang thu gọn (desktop)
export function N7AiPanelToggle() {
  const open = useN7AiLayout((s) => s.panelOpen)
  const setOpen = useN7AiLayout((s) => s.setPanelOpen)
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

// Panel phải (desktop, độ rộng do khung N7AI đặt): tab Tài liệu (danh sách + xem trước) · tab Công cụ (tạo học liệu từ hội thoại / tài liệu)
export function N7AiSidePanel({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const tab = useN7AiLayout((s) => s.panelTab)
  const setTab = useN7AiLayout((s) => s.setPanelTab)
  const setOpen = useN7AiLayout((s) => s.setPanelOpen)
  const { id: threadId } = useParams<{ id?: string }>()
  return (
    <aside
      aria-label="Tài liệu và công cụ"
      style={style}
      className={cn(
        'sticky top-0 h-dvh shrink-0 flex-col border-l border-border/60 bg-surface',
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

// Nút bật / tắt panel ở đầu hội thoại (desktop): luôn thấy, không phụ thuộc đang mở hay đóng
export function N7AiPanelButton() {
  const open = useN7AiLayout((s) => s.panelOpen)
  const setOpen = useN7AiLayout((s) => s.setPanelOpen)
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-pressed={open}
      title={open ? 'Thu gọn panel tài liệu' : 'Mở panel tài liệu và công cụ'}
      aria-label="Panel tài liệu và công cụ"
      className={cn(
        'hidden h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-muted lg:flex',
        open ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <PanelRight className="h-4 w-4" />
    </button>
  )
}
