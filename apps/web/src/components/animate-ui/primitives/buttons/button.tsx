'use client';

import * as React from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';
import { Slot, type WithAsChild } from '@/components/animate-ui/primitives/animate/slot';

export type ButtonProps = WithAsChild<
  HTMLMotionProps<'button'> & {
    hoverScale?: number;
    tapScale?: number;
  }
>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      hoverScale = 1.02,
      tapScale = 0.96,
      asChild = false,
      ...props
    },
    ref
  ) => {
    const Component = asChild ? Slot : motion.button;

    return (
      <Component
        ref={ref as unknown as React.Ref<HTMLButtonElement>}
        whileTap={{ scale: tapScale }}
        whileHover={{ scale: hoverScale }}
        transition={{ type: 'spring', stiffness: 450, damping: 25 }}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
