'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react'

import { useControlledState } from '@/hooks/use-controlled-state'
import { getStrictContext } from '@/lib/get-strict-context'

export type DialogContextType = {
  isOpen: boolean
  setIsOpen: DialogProps['onOpenChange']
}

const [DialogProvider, useDialog] = getStrictContext<DialogContextType>('DialogContext')

export type DialogProps = React.ComponentProps<typeof DialogPrimitive.Root>

export function Dialog(props: DialogProps) {
  const [isOpen, setIsOpen] = useControlledState({
    value: props?.open,
    defaultValue: props?.defaultOpen,
    onChange: props?.onOpenChange
  })

  return (
    <DialogProvider value={{ isOpen, setIsOpen }}>
      <DialogPrimitive.Root data-slot="dialog" {...props} onOpenChange={setIsOpen} />
    </DialogProvider>
  )
}

export type DialogTriggerProps = React.ComponentProps<typeof DialogPrimitive.Trigger>

export function DialogTrigger(props: DialogTriggerProps) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

export type DialogPortalProps = Omit<React.ComponentProps<typeof DialogPrimitive.Portal>, 'forceMount'>

export function DialogPortal(props: DialogPortalProps) {
  const { isOpen } = useDialog()

  return <AnimatePresence>{isOpen && <DialogPrimitive.Portal data-slot="dialog-portal" forceMount {...props} />}</AnimatePresence>
}

export type DialogOverlayProps = Omit<React.ComponentProps<typeof DialogPrimitive.Overlay>, 'forceMount' | 'asChild'> & HTMLMotionProps<'div'>

export function DialogOverlay({ transition = { duration: 0.1, ease: 'easeOut' }, ...props }: DialogOverlayProps) {
  return (
    <DialogPrimitive.Overlay data-slot="dialog-overlay" asChild forceMount>
      <motion.div
        key="dialog-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={transition}
        {...props}
      />
    </DialogPrimitive.Overlay>
  )
}

export type DialogFlipDirection = 'top' | 'bottom' | 'left' | 'right'

export type DialogContentProps = Omit<React.ComponentProps<typeof DialogPrimitive.Content>, 'forceMount' | 'asChild'> &
  HTMLMotionProps<'div'> & {
    from?: DialogFlipDirection
  }

export function DialogContent({
  from: _from = 'top', // giữ prop cho tương thích (không còn hiệu ứng xoay)
  onOpenAutoFocus,
  onCloseAutoFocus,
  onEscapeKeyDown,
  onPointerDownOutside,
  onInteractOutside,
  transition = { type: 'tween', duration: 0.1, ease: [0.16, 1, 0.3, 1] },
  ...props
}: DialogContentProps) {

  return (
    <DialogPrimitive.Content
      asChild
      forceMount
      onOpenAutoFocus={onOpenAutoFocus}
      onCloseAutoFocus={onCloseAutoFocus}
      onEscapeKeyDown={onEscapeKeyDown}
      onPointerDownOutside={onPointerDownOutside}
      onInteractOutside={onInteractOutside}
    >
      <motion.div
        key="dialog-content"
        data-slot="dialog-content"
        // Chỉ opacity + scale (GPU, không blur / xoay 3D): hộp nội dung dài (danh sách, form) mở mượt, không giật
        initial={{ opacity: 0, transform: 'scale(0.96)' }}
        animate={{ opacity: 1, transform: 'scale(1)' }}
        exit={{ opacity: 0, transform: 'scale(0.96)' }}
        transition={transition}
        {...props}
      />
    </DialogPrimitive.Content>
  )
}

export type DialogCloseProps = React.ComponentProps<typeof DialogPrimitive.Close>

export function DialogClose(props: DialogCloseProps) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

export type DialogHeaderProps = React.ComponentProps<'div'>

export function DialogHeader(props: DialogHeaderProps) {
  return <div data-slot="dialog-header" {...props} />
}

export type DialogFooterProps = React.ComponentProps<'div'>

export function DialogFooter(props: DialogFooterProps) {
  return <div data-slot="dialog-footer" {...props} />
}

export type DialogTitleProps = React.ComponentProps<typeof DialogPrimitive.Title>

export function DialogTitle(props: DialogTitleProps) {
  return <DialogPrimitive.Title data-slot="dialog-title" {...props} />
}

export type DialogDescriptionProps = React.ComponentProps<typeof DialogPrimitive.Description>

export function DialogDescription(props: DialogDescriptionProps) {
  return <DialogPrimitive.Description data-slot="dialog-description" {...props} />
}

export { useDialog }
