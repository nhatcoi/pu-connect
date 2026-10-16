'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  Popover as PopoverPrimitive,
  PopoverTrigger as PopoverTriggerPrimitive,
  PopoverContent as PopoverContentPrimitive,
  PopoverPortal as PopoverPortalPrimitive,
  PopoverAnchor as PopoverAnchorPrimitive,
  PopoverClose as PopoverClosePrimitive,
  type PopoverProps as PopoverPrimitiveProps,
  type PopoverTriggerProps as PopoverTriggerPrimitiveProps,
  type PopoverContentProps as PopoverContentPrimitiveProps,
  type PopoverAnchorProps as PopoverAnchorPrimitiveProps,
  type PopoverCloseProps as PopoverClosePrimitiveProps
} from '@/components/animate-ui/primitives/radix/popover'

function Popover(props: PopoverPrimitiveProps) {
  return <PopoverPrimitive {...props} />
}

const PopoverTrigger = PopoverTriggerPrimitive
const PopoverAnchor = PopoverAnchorPrimitive
const PopoverClose = PopoverClosePrimitive

function PopoverContent({ className, align = 'center', sideOffset = 4, ...props }: PopoverContentPrimitiveProps) {
  return (
    <PopoverPortalPrimitive>
      <PopoverContentPrimitive
        align={align}
        sideOffset={sideOffset}
        className={cn('bg-popover text-popover-foreground z-50 w-72 rounded-md border p-4 shadow-md outline-hidden', className)}
        {...props}
      />
    </PopoverPortalPrimitive>
  )
}

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  PopoverClose,
  type PopoverPrimitiveProps as PopoverProps,
  type PopoverTriggerPrimitiveProps as PopoverTriggerProps,
  type PopoverContentPrimitiveProps as PopoverContentProps,
  type PopoverAnchorPrimitiveProps as PopoverAnchorProps,
  type PopoverClosePrimitiveProps as PopoverCloseProps
}
