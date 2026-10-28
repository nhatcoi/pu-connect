'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog as DialogPrimitive,
  DialogTrigger as DialogTriggerPrimitive,
  DialogPortal as DialogPortalPrimitive,
  DialogOverlay as DialogOverlayPrimitive,
  DialogContent as DialogContentPrimitive,
  DialogClose as DialogClosePrimitive,
  DialogHeader as DialogHeaderPrimitive,
  DialogFooter as DialogFooterPrimitive,
  DialogTitle as DialogTitlePrimitive,
  DialogDescription as DialogDescriptionPrimitive,
  type DialogProps as DialogPrimitiveProps,
  type DialogTriggerProps as DialogTriggerPrimitiveProps,
  type DialogPortalProps as DialogPortalPrimitiveProps,
  type DialogOverlayProps as DialogOverlayPrimitiveProps,
  type DialogContentProps as DialogContentPrimitiveProps,
  type DialogCloseProps as DialogClosePrimitiveProps,
  type DialogHeaderProps as DialogHeaderPrimitiveProps,
  type DialogFooterProps as DialogFooterPrimitiveProps,
  type DialogTitleProps as DialogTitlePrimitiveProps,
  type DialogDescriptionProps as DialogDescriptionPrimitiveProps
} from '@/components/animate-ui/primitives/radix/dialog'

const Dialog = DialogPrimitive
const DialogTrigger = DialogTriggerPrimitive
const DialogPortal = DialogPortalPrimitive
const DialogClose = DialogClosePrimitive

export type DialogProps = DialogPrimitiveProps
export type DialogTriggerProps = DialogTriggerPrimitiveProps
export type DialogPortalProps = DialogPortalPrimitiveProps
export type DialogOverlayProps = DialogOverlayPrimitiveProps
export type DialogCloseProps = DialogClosePrimitiveProps
export type DialogHeaderProps = DialogHeaderPrimitiveProps
export type DialogFooterProps = DialogFooterPrimitiveProps
export type DialogTitleProps = DialogTitlePrimitiveProps
export type DialogDescriptionProps = DialogDescriptionPrimitiveProps

function DialogOverlay({ className, ...props }: DialogOverlayProps) {
  return <DialogOverlayPrimitive className={cn('fixed inset-0 z-50 bg-black/60', className)} {...props} />
}

export type DialogContentProps = DialogContentPrimitiveProps & {
  showCloseButton?: boolean
}

function DialogContent({ className, children, showCloseButton = true, ...props }: DialogContentProps) {
  return (
    <DialogPortalPrimitive>
      <DialogOverlay />
      <DialogContentPrimitive
        className={cn(
          'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto outline-none',
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogClosePrimitive className="absolute right-4 top-4 rounded-full p-1.5 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none hover:bg-muted cursor-pointer">
            <X className="h-4 w-4" />
            <span className="sr-only">Đóng</span>
          </DialogClosePrimitive>
        )}
      </DialogContentPrimitive>
    </DialogPortalPrimitive>
  )
}

function DialogHeader({ className, ...props }: DialogHeaderProps) {
  return <DialogHeaderPrimitive className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
}

function DialogFooter({ className, ...props }: DialogFooterProps) {
  return <DialogFooterPrimitive className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)} {...props} />
}

function DialogTitle({ className, ...props }: DialogTitleProps) {
  return <DialogTitlePrimitive className={cn('text-lg font-semibold leading-none tracking-tight text-foreground', className)} {...props} />
}

function DialogDescription({ className, ...props }: DialogDescriptionProps) {
  return <DialogDescriptionPrimitive className={cn('text-sm text-muted-foreground', className)} {...props} />
}

export { Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription }
