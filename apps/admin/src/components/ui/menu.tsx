import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/api'
import { Button } from './button'

const MenuCtx = React.createContext<() => void>(() => {})

// Đóng menu từ phần tử tùy biến bên trong panel
export const useMenuClose = () => React.useContext(MenuCtx)

// Dropdown menu render qua portal (không bị cắt bởi bảng overflow)
export function Menu({
  trigger,
  children,
  align = 'end',
  width = 220
}: {
  trigger?: (props: { onClick: () => void; 'aria-expanded': boolean }) => React.ReactNode
  children: React.ReactNode
  align?: 'start' | 'end'
  width?: number
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const anchorRef = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])

  // Tính vị trí theo nút bấm; lật lên nếu tràn đáy màn hình
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const r = anchorRef.current.getBoundingClientRect()
    const h = panelRef.current?.offsetHeight ?? 0
    const left = align === 'end' ? r.right - width : r.left
    const below = r.bottom + 4
    const top = below + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 4) : below
    setPos({ top, left: Math.min(Math.max(8, left), window.innerWidth - width - 8) })
  }, [open, align, width])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!panelRef.current?.contains(t) && !anchorRef.current?.contains(t)) close()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    // Cuộn trang ⇒ đóng; cuộn bên trong panel thì giữ
    const onScroll = (e: Event) => {
      if (!panelRef.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', close)
    }
  }, [open, close])

  const toggle = () => {
    setPos(null)
    setOpen((v) => !v)
  }

  return (
    <>
      <span ref={anchorRef} className="inline-flex" onClick={(e) => e.stopPropagation()}>
        {trigger ? (
          trigger({ onClick: toggle, 'aria-expanded': open })
        ) : (
          <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="Thao tác">
            <MoreHorizontal />
          </Button>
        )}
      </span>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            onClick={(e) => e.stopPropagation()}
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width }}
            className="fixed z-50 rounded-lg border border-border bg-popover p-1 text-sm shadow-lg shadow-black/10"
          >
            <MenuCtx.Provider value={close}>{children}</MenuCtx.Provider>
          </div>,
          document.body
        )}
    </>
  )
}

export function MenuItem({
  icon: Icon,
  children,
  onSelect,
  danger,
  checked,
  disabled
}: {
  icon?: React.ElementType
  children: React.ReactNode
  onSelect: () => void
  danger?: boolean
  checked?: boolean
  disabled?: boolean
}) {
  const close = React.useContext(MenuCtx)
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        close()
        onSelect()
      }}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-40',
        danger ? 'text-danger hover:bg-red-500/10' : 'text-foreground hover:bg-accent'
      )}
    >
      {Icon ? <Icon className="size-4 shrink-0 opacity-70" /> : checked !== undefined ? <span className="size-4 shrink-0" /> : null}
      <span className="flex-1 truncate">{children}</span>
      {checked && <Check className="size-4 shrink-0 text-primary" />}
    </button>
  )
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-muted-foreground">{children}</div>
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-border" />
}
