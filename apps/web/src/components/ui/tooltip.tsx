'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip as TooltipPrimitive,
  TooltipTrigger as TooltipTriggerPrimitive,
  TooltipContent as TooltipContentPrimitive,
  TooltipProvider as TooltipProviderPrimitive,
  TooltipPortal as TooltipPortalPrimitive,
  TooltipArrow as TooltipArrowPrimitive,
  type TooltipProps as TooltipPrimitiveProps,
  type TooltipTriggerProps as TooltipTriggerPrimitiveProps,
  type TooltipContentProps as TooltipContentPrimitiveProps,
  type TooltipProviderProps as TooltipProviderPrimitiveProps,
} from '@/components/animate-ui/primitives/radix/tooltip';

function TooltipProvider({
  delayDuration = 100,
  ...props
}: TooltipProviderPrimitiveProps) {
  return <TooltipProviderPrimitive delayDuration={delayDuration} {...props} />;
}

function Tooltip(props: TooltipPrimitiveProps) {
  return <TooltipPrimitive {...props} />;
}

const TooltipTrigger = TooltipTriggerPrimitive;

function TooltipContent({
  className,
  sideOffset = 4,
  children,
  ...props
}: TooltipContentPrimitiveProps) {
  return (
    <TooltipPortalPrimitive>
      <TooltipContentPrimitive
        sideOffset={sideOffset}
        className={cn(
          'bg-primary text-primary-foreground z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance shadow-md',
          className
        )}
        {...props}
      >
        {children}
      </TooltipContentPrimitive>
    </TooltipPortalPrimitive>
  );
}

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  TooltipPortalPrimitive as TooltipPortal,
  TooltipArrowPrimitive as TooltipArrow,
  type TooltipPrimitiveProps as TooltipProps,
  type TooltipTriggerPrimitiveProps as TooltipTriggerProps,
  type TooltipContentPrimitiveProps as TooltipContentProps,
  type TooltipProviderPrimitiveProps as TooltipProviderProps,
};
