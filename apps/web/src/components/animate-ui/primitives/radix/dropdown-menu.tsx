'use client';

import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react';

import {
  Highlight,
  HighlightItem,
  type HighlightItemProps,
  type HighlightProps,
} from '@/components/animate-ui/primitives/effects/highlight';
import { getStrictContext } from '@/lib/get-strict-context';
import { useControlledState } from '@/hooks/use-controlled-state';
import { useDataState } from '@/hooks/use-data-state';

export type DropdownMenuContextType = {
  isOpen: boolean;
  setIsOpen: (o: boolean) => void;
  highlightedValue: string | null;
  setHighlightedValue: (value: string | null) => void;
};

export type DropdownMenuSubContextType = {
  isOpen: boolean;
  setIsOpen: (o: boolean) => void;
};

const [DropdownMenuProvider, useDropdownMenu] =
  getStrictContext<DropdownMenuContextType>('DropdownMenuContext');

const [DropdownMenuSubProvider, useDropdownMenuSub] =
  getStrictContext<DropdownMenuSubContextType>('DropdownMenuSubContext');

export type DropdownMenuProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.Root
>;

export function DropdownMenu(props: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useControlledState({
    value: props?.open,
    defaultValue: props?.defaultOpen,
    onChange: props?.onOpenChange,
  });
  const [highlightedValue, setHighlightedValue] = React.useState<string | null>(
    null,
  );

  return (
    <DropdownMenuProvider
      value={{ isOpen, setIsOpen, highlightedValue, setHighlightedValue }}
    >
      <DropdownMenuPrimitive.Root
        data-slot="dropdown-menu"
        {...props}
        onOpenChange={setIsOpen}
      />
    </DropdownMenuProvider>
  );
}

export type DropdownMenuTriggerProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.Trigger
>;

export function DropdownMenuTrigger(props: DropdownMenuTriggerProps) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  );
}

export type DropdownMenuPortalProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.Portal
>;

export function DropdownMenuPortal(props: DropdownMenuPortalProps) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  );
}

export type DropdownMenuGroupProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.Group
>;

export function DropdownMenuGroup(props: DropdownMenuGroupProps) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  );
}

export type DropdownMenuSubProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.Sub
>;

export function DropdownMenuSub(props: DropdownMenuSubProps) {
  const [isOpen, setIsOpen] = useControlledState({
    value: props?.open,
    defaultValue: props?.defaultOpen,
    onChange: props?.onOpenChange,
  });

  return (
    <DropdownMenuSubProvider value={{ isOpen, setIsOpen }}>
      <DropdownMenuPrimitive.Sub
        data-slot="dropdown-menu-sub"
        {...props}
        onOpenChange={setIsOpen}
      />
    </DropdownMenuSubProvider>
  );
}

export type DropdownMenuRadioGroupProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.RadioGroup
>;

export function DropdownMenuRadioGroup(props: DropdownMenuRadioGroupProps) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  );
}

export type DropdownMenuSubTriggerProps = Omit<
  React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger>,
  'asChild'
> &
  HTMLMotionProps<'div'>;

export function DropdownMenuSubTrigger({
  disabled,
  textValue,
  ...props
}: DropdownMenuSubTriggerProps) {
  const { setHighlightedValue } = useDropdownMenu();
  const [, highlightedRef] = useDataState<HTMLDivElement>(
    'highlighted',
    undefined,
    (value) => {
      if (value === true) {
        const el = highlightedRef.current;
        const v = el?.dataset.value || el?.id || null;
        if (v) setHighlightedValue(v);
      }
    },
  );

  return (
    <DropdownMenuPrimitive.SubTrigger
      ref={highlightedRef as unknown as React.Ref<HTMLDivElement>}
      disabled={disabled}
      textValue={textValue}
      asChild
    >
      <motion.div
        data-slot="dropdown-menu-sub-trigger"
        data-disabled={disabled}
        {...props}
      />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

export type DropdownMenuSubContentProps = Omit<
  React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>,
  'forceMount' | 'asChild'
> &
  Omit<
    React.ComponentProps<typeof DropdownMenuPrimitive.Portal>,
    'forceMount'
  > &
  HTMLMotionProps<'div'>;

export function DropdownMenuSubContent({
  loop,
  onEscapeKeyDown,
  onPointerDownOutside,
  onFocusOutside,
  onInteractOutside,
  sideOffset,
  alignOffset,
  avoidCollisions,
  collisionBoundary,
  collisionPadding,
  arrowPadding,
  sticky,
  hideWhenDetached,
  transition = { duration: 0.2 },
  style,
  container,
  ...props
}: DropdownMenuSubContentProps) {
  const { isOpen } = useDropdownMenuSub();

  return (
    <AnimatePresence>
      {isOpen && (
        <DropdownMenuPortal forceMount container={container}>
          <DropdownMenuPrimitive.SubContent
            asChild
            forceMount
            loop={loop}
            onEscapeKeyDown={onEscapeKeyDown}
            onPointerDownOutside={onPointerDownOutside}
            onFocusOutside={onFocusOutside}
            onInteractOutside={onInteractOutside}
            sideOffset={sideOffset}
            alignOffset={alignOffset}
            avoidCollisions={avoidCollisions}
            collisionBoundary={collisionBoundary}
            collisionPadding={collisionPadding}
            arrowPadding={arrowPadding}
            sticky={sticky}
            hideWhenDetached={hideWhenDetached}
          >
            <motion.div
              key="dropdown-menu-sub-content"
              data-slot="dropdown-menu-sub-content"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={transition}
              style={{ willChange: 'opacity, transform', ...style }}
              {...props}
            />
          </DropdownMenuPrimitive.SubContent>
        </DropdownMenuPortal>
      )}
    </AnimatePresence>
  );
}

export type DropdownMenuHighlightProps = Omit<
  HighlightProps,
  'controlledItems' | 'enabled' | 'hover'
> & {
  animateOnHover?: boolean;
};

export function DropdownMenuHighlight({
  transition = { type: 'spring', stiffness: 350, damping: 35 },
  ...props
}: DropdownMenuHighlightProps) {
  const { highlightedValue } = useDropdownMenu();

  return (
    <Highlight
      data-slot="dropdown-menu-highlight"
      click={false}
      controlledItems
      transition={transition}
      value={highlightedValue}
      {...props}
    />
  );
}

export type DropdownMenuContentProps = Omit<
  React.ComponentProps<typeof DropdownMenuPrimitive.Content>,
  'forceMount' | 'asChild'
> &
  Omit<
    React.ComponentProps<typeof DropdownMenuPrimitive.Portal>,
    'forceMount'
  > &
  HTMLMotionProps<'div'>;

export function DropdownMenuContent({
  loop,
  onCloseAutoFocus,
  onEscapeKeyDown,
  onPointerDownOutside,
  onFocusOutside,
  onInteractOutside,
  side,
  sideOffset,
  align,
  alignOffset,
  avoidCollisions,
  collisionBoundary,
  collisionPadding,
  arrowPadding,
  sticky,
  hideWhenDetached,
  transition = { duration: 0.2 },
  style,
  container,
  ...props
}: DropdownMenuContentProps) {
  const { isOpen } = useDropdownMenu();

  return (
    <AnimatePresence>
      {isOpen && (
        <DropdownMenuPortal forceMount container={container}>
          <DropdownMenuPrimitive.Content
            asChild
            loop={loop}
            onCloseAutoFocus={onCloseAutoFocus}
            onEscapeKeyDown={onEscapeKeyDown}
            onPointerDownOutside={onPointerDownOutside}
            onFocusOutside={onFocusOutside}
            onInteractOutside={onInteractOutside}
            side={side}
            sideOffset={sideOffset}
            align={align}
            alignOffset={alignOffset}
            avoidCollisions={avoidCollisions}
            collisionBoundary={collisionBoundary}
            collisionPadding={collisionPadding}
            arrowPadding={arrowPadding}
            sticky={sticky}
            hideWhenDetached={hideWhenDetached}
          >
            <motion.div
              key="dropdown-menu-content"
              data-slot="dropdown-menu-content"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={transition}
              style={{ willChange: 'opacity, transform', ...style }}
              {...props}
            />
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPortal>
      )}
    </AnimatePresence>
  );
}

export type DropdownMenuHighlightItemProps = HighlightItemProps;

export function DropdownMenuHighlightItem(props: DropdownMenuHighlightItemProps) {
  return <HighlightItem data-slot="dropdown-menu-highlight-item" {...props} />;
}

export type DropdownMenuItemProps = Omit<
  React.ComponentProps<typeof DropdownMenuPrimitive.Item>,
  'asChild'
> &
  HTMLMotionProps<'div'>;

export function DropdownMenuItem({
  disabled,
  onSelect,
  textValue,
  ...props
}: DropdownMenuItemProps) {
  const { setHighlightedValue } = useDropdownMenu();
  const [, highlightedRef] = useDataState<HTMLDivElement>(
    'highlighted',
    undefined,
    (value) => {
      if (value === true) {
        const el = highlightedRef.current;
        const v = el?.dataset.value || el?.id || null;
        if (v) setHighlightedValue(v);
      }
    },
  );

  return (
    <DropdownMenuPrimitive.Item
      ref={highlightedRef as unknown as React.Ref<HTMLDivElement>}
      disabled={disabled}
      onSelect={onSelect}
      textValue={textValue}
      asChild
    >
      <motion.div
        data-slot="dropdown-menu-item"
        data-disabled={disabled}
        {...props}
      />
    </DropdownMenuPrimitive.Item>
  );
}

export type DropdownMenuCheckboxItemProps = Omit<
  React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>,
  'asChild'
> &
  HTMLMotionProps<'div'>;

export function DropdownMenuCheckboxItem({
  checked,
  onCheckedChange,
  disabled,
  onSelect,
  textValue,
  ...props
}: DropdownMenuCheckboxItemProps) {
  const { setHighlightedValue } = useDropdownMenu();
  const [, highlightedRef] = useDataState<HTMLDivElement>(
    'highlighted',
    undefined,
    (value) => {
      if (value === true) {
        const el = highlightedRef.current;
        const v = el?.dataset.value || el?.id || null;
        if (v) setHighlightedValue(v);
      }
    },
  );

  return (
    <DropdownMenuPrimitive.CheckboxItem
      ref={highlightedRef as unknown as React.Ref<HTMLDivElement>}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      onSelect={onSelect}
      textValue={textValue}
      asChild
    >
      <motion.div
        data-slot="dropdown-menu-checkbox-item"
        data-disabled={disabled}
        {...props}
      />
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

export type DropdownMenuRadioItemProps = Omit<
  React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>,
  'asChild'
> &
  HTMLMotionProps<'div'>;

export function DropdownMenuRadioItem({
  value,
  disabled,
  onSelect,
  textValue,
  ...props
}: DropdownMenuRadioItemProps) {
  const { setHighlightedValue } = useDropdownMenu();
  const [, highlightedRef] = useDataState<HTMLDivElement>(
    'highlighted',
    undefined,
    (value) => {
      if (value === true) {
        const el = highlightedRef.current;
        const v = el?.dataset.value || el?.id || null;
        if (v) setHighlightedValue(v);
      }
    },
  );

  return (
    <DropdownMenuPrimitive.RadioItem
      ref={highlightedRef as unknown as React.Ref<HTMLDivElement>}
      value={value}
      disabled={disabled}
      onSelect={onSelect}
      textValue={textValue}
      asChild
    >
      <motion.div
        data-slot="dropdown-menu-radio-item"
        data-disabled={disabled}
        {...props}
      />
    </DropdownMenuPrimitive.RadioItem>
  );
}

export type DropdownMenuLabelProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.Label
>;

export function DropdownMenuLabel(props: DropdownMenuLabelProps) {
  return (
    <DropdownMenuPrimitive.Label data-slot="dropdown-menu-label" {...props} />
  );
}

export type DropdownMenuSeparatorProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.Separator
>;

export function DropdownMenuSeparator(props: DropdownMenuSeparatorProps) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      {...props}
    />
  );
}

export type DropdownMenuShortcutProps = React.ComponentProps<'span'>;

export function DropdownMenuShortcut(props: DropdownMenuShortcutProps) {
  return <span data-slot="dropdown-menu-shortcut" {...props} />;
}

export type DropdownMenuItemIndicatorProps = Omit<
  React.ComponentProps<typeof DropdownMenuPrimitive.ItemIndicator>,
  'asChild'
> &
  HTMLMotionProps<'div'>;

export function DropdownMenuItemIndicator(props: DropdownMenuItemIndicatorProps) {
  return (
    <DropdownMenuPrimitive.ItemIndicator
      data-slot="dropdown-menu-item-indicator"
      asChild
    >
      <motion.div {...props} />
    </DropdownMenuPrimitive.ItemIndicator>
  );
}

export {
  useDropdownMenu,
  useDropdownMenuSub,
};
