'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  Switch as SwitchPrimitive,
  SwitchThumb as SwitchThumbPrimitive,
  SwitchIcon as SwitchIconPrimitive,
  type SwitchProps as SwitchPrimitiveProps
} from '@/components/animate-ui/primitives/radix/switch'

export type SwitchProps = SwitchPrimitiveProps & {
  pressedWidth?: number
  startIcon?: React.ReactElement
  endIcon?: React.ReactElement
  thumbIcon?: React.ReactElement
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(({ className, pressedWidth = 18, startIcon, endIcon, thumbIcon, ...props }, ref) => {
  return (
    <SwitchPrimitive
      ref={ref}
      className={cn(
        'relative peer focus-visible:border-ring focus-visible:ring-ring/50 flex h-5 w-9 px-0.5 shrink-0 cursor-pointer items-center justify-start rounded-full border border-transparent shadow-xs outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
        'data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:data-[state=unchecked]:bg-input/80 data-[state=checked]:justify-end',
        className
      )}
      {...props}
    >
      <SwitchThumbPrimitive
        className={cn(
          'relative z-10 bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full shadow-md'
        )}
        pressedAnimation={{ width: pressedWidth }}
      >
        {thumbIcon && (
          <SwitchIconPrimitive position="thumb" className="absolute [&_svg]:size-2.5 left-1/2 top-1/2 -translate-1/2 dark:text-neutral-500 text-neutral-400">
            {thumbIcon}
          </SwitchIconPrimitive>
        )}
      </SwitchThumbPrimitive>

      {startIcon && (
        <SwitchIconPrimitive position="left" className="absolute [&_svg]:size-2.5 left-1 top-1/2 -translate-y-1/2 dark:text-neutral-500 text-neutral-400">
          {startIcon}
        </SwitchIconPrimitive>
      )}
      {endIcon && (
        <SwitchIconPrimitive position="right" className="absolute [&_svg]:size-2.5 right-1 top-1/2 -translate-y-1/2 dark:text-neutral-400 text-neutral-500">
          {endIcon}
        </SwitchIconPrimitive>
      )}
    </SwitchPrimitive>
  )
})
Switch.displayName = 'Switch'

export { Switch }
