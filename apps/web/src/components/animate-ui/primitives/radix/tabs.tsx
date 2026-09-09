'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import {
  motion,
  AnimatePresence,
  type HTMLMotionProps,
  type Transition,
} from 'motion/react';

import {
  Highlight,
  HighlightItem,
  type HighlightProps,
  type HighlightItemProps,
} from '@/components/animate-ui/primitives/effects/highlight';
import { getStrictContext } from '@/lib/get-strict-context';
import { useControlledState } from '@/hooks/use-controlled-state';
import {
  AutoHeight,
  type AutoHeightProps,
} from '@/components/animate-ui/primitives/effects/auto-height';

export type TabsContextType = {
  value: string | undefined;
  setValue: TabsProps['onValueChange'];
};

const [TabsProvider, useTabs] =
  getStrictContext<TabsContextType>('TabsContext');

export type TabsProps = React.ComponentProps<typeof TabsPrimitive.Root>;

export function Tabs(props: TabsProps) {
  const [value, setValue] = useControlledState({
    value: props.value,
    defaultValue: props.defaultValue,
    onChange: props.onValueChange,
  });

  return (
    <TabsProvider value={{ value, setValue }}>
      <TabsPrimitive.Root
        data-slot="tabs"
        {...props}
        onValueChange={setValue}
      />
    </TabsProvider>
  );
}

export type TabsHighlightProps = Omit<HighlightProps, 'controlledItems' | 'value'>;

export function TabsHighlight({
  transition = { type: 'spring', stiffness: 400, damping: 30 },
  ...props
}: TabsHighlightProps) {
  const { value } = useTabs();

  return (
    <Highlight
      data-slot="tabs-highlight"
      controlledItems
      value={value}
      transition={transition}
      click={false}
      {...props}
    />
  );
}

export type TabsListProps = React.ComponentProps<typeof TabsPrimitive.List>;

export function TabsList(props: TabsListProps) {
  return <TabsPrimitive.List data-slot="tabs-list" {...props} />;
}

export type TabsHighlightItemProps = HighlightItemProps & {
  value: string;
};

export function TabsHighlightItem(props: TabsHighlightItemProps) {
  return <HighlightItem data-slot="tabs-highlight-item" {...props} />;
}

export type TabsTriggerProps = React.ComponentProps<typeof TabsPrimitive.Trigger>;

export function TabsTrigger(props: TabsTriggerProps) {
  return <TabsPrimitive.Trigger data-slot="tabs-trigger" {...props} />;
}

export type TabsContentProps = React.ComponentProps<typeof TabsPrimitive.Content> &
  HTMLMotionProps<'div'>;

export function TabsContent({
  value,
  forceMount,
  transition = { duration: 0.25, ease: 'easeInOut' },
  ...props
}: TabsContentProps) {
  return (
    <AnimatePresence mode="wait">
      <TabsPrimitive.Content asChild forceMount={forceMount} value={value}>
        <motion.div
          data-slot="tabs-content"
          initial={{ opacity: 0, filter: 'blur(3px)', y: 4 }}
          animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
          exit={{ opacity: 0, filter: 'blur(3px)', y: -4 }}
          transition={transition}
          {...props}
        />
      </TabsPrimitive.Content>
    </AnimatePresence>
  );
}

export type TabsContentsAutoProps = AutoHeightProps & {
  mode?: 'auto-height';
  children: React.ReactNode;
  transition?: Transition;
};

export type TabsContentsLayoutProps = Omit<HTMLMotionProps<'div'>, 'transition'> & {
  mode: 'layout';
  children: React.ReactNode;
  transition?: Transition;
};

export type TabsContentsProps = TabsContentsAutoProps | TabsContentsLayoutProps;

const defaultTransition: Transition = {
  type: 'spring',
  stiffness: 250,
  damping: 28,
};

function isAutoMode(props: TabsContentsProps): props is TabsContentsAutoProps {
  return !('mode' in props) || props.mode === 'auto-height';
}

export function TabsContents(props: TabsContentsProps) {
  const { value } = useTabs();

  if (isAutoMode(props)) {
    const { transition = defaultTransition, ...autoProps } = props;

    return (
      <AutoHeight
        data-slot="tabs-contents"
        deps={[value]}
        transition={transition}
        {...autoProps}
      />
    );
  }

  const { transition = defaultTransition, style, ...layoutProps } = props;

  return (
    <motion.div
      data-slot="tabs-contents"
      layout="size"
      layoutDependency={value}
      style={{ overflow: 'hidden', ...style }}
      transition={{ layout: transition }}
      {...layoutProps}
    />
  );
}

export { useTabs };
