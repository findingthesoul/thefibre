import * as React from 'react';
import { cn } from '@/lib/utils';

// Bare Input primitive. Matches Fibre's `field.tsx` styling so the same look
// applies whether you use TextField (label-wrapped) or this directly.

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      'mt-1 w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:border-line-strong focus:outline-none placeholder:text-ink-muted disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';
