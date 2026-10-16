'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  Tabs as TabsPrimitive,
  TabsList as TabsListPrimitive,
  TabsTrigger as TabsTriggerPrimitive,
  TabsContent as TabsContentPrimitive,
  TabsHighlight as TabsHighlightPrimitive,
  TabsHighlightItem as TabsHighlightItemPrimitive,
  type TabsProps as TabsPrimitiveProps,
  type TabsListProps as TabsListPrimitiveProps,
  type TabsTriggerProps as TabsTriggerPrimitiveProps,
  type TabsContentProps as TabsContentPrimitiveProps
} from '@/components/animate-ui/primitives/radix/tabs'

export type TabsProps = TabsPrimitiveProps
export type TabsListProps = TabsListPrimitiveProps
export type TabsTriggerProps = TabsTriggerPrimitiveProps
export type TabsContentProps = TabsContentPrimitiveProps

function Tabs({ className, ...props }: TabsProps) {
  return <TabsPrimitive className={cn('flex flex-col gap-2', className)} {...props} />
}

function TabsList({ className, ...props }: TabsListProps) {
  return (
    <TabsHighlightPrimitive className="absolute z-0 inset-0 border border-transparent rounded-md bg-background dark:border-input dark:bg-input/30 shadow-xs">
      <TabsListPrimitive
        className={cn('bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]', className)}
        {...props}
      />
    </TabsHighlightPrimitive>
  )
}

function TabsTrigger({ className, value, ...props }: TabsTriggerProps) {
  return (
    <TabsHighlightItemPrimitive value={value} className="flex-1">
      <TabsTriggerPrimitive
        value={value}
        className={cn(
          "data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md w-full px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors duration-200 ease-in-out focus-visible:ring-[2px] focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          className
        )}
        {...props}
      />
    </TabsHighlightItemPrimitive>
  )
}

function TabsContent({ className, ...props }: TabsContentProps) {
  return <TabsContentPrimitive className={cn('mt-2 ring-offset-background focus-visible:outline-none', className)} {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
