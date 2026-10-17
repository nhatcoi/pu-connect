import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/api'
import { Button } from './button'
import { Textarea } from './input'

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md'
}: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          'flex max-h-[90vh] w-full flex-col rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-xl',
          size === 'sm' ? 'sm:max-w-md' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg'
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Đóng" className="-mr-2 -mt-1">
            <X />
          </Button>
        </div>
        {children && <div className="overflow-y-auto px-5 py-4">{children}</div>}
        {footer && <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}

// Hộp xác nhận thao tác nguy hiểm (tùy chọn nhập lý do)
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Xác nhận',
  withReason,
  reasonPlaceholder = 'Lý do (không bắt buộc)',
  loading
}: {
  open: boolean
  onClose: () => void
  onConfirm: (reason?: string) => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  withReason?: boolean
  reasonPlaceholder?: string
  loading?: boolean
}) {
  const [reason, setReason] = useState('')
  useEffect(() => {
    if (open) setReason('')
  }, [open])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="danger" loading={loading} onClick={() => onConfirm(reason.trim() || undefined)}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {withReason ? (
        <Textarea autoFocus rows={3} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={reasonPlaceholder} />
      ) : null}
    </Dialog>
  )
}
