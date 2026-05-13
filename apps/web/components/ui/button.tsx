import Link from 'next/link';
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-line-strong';

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-9 px-4 text-sm',
};

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-ink-inverse hover:opacity-90',
  secondary: 'border border-line bg-surface-raised text-ink hover:bg-surface-sunken',
  ghost: 'text-ink-subtle hover:text-ink hover:bg-surface-sunken',
  danger:
    'border border-red-300 bg-red-50 text-red-800 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/40 dark:hover:bg-red-950/50',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  leading?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', leading, className = '', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {leading}
      {children}
    </button>
  );
});

type LinkProps = ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
  leading?: ReactNode;
};

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  leading,
  className = '',
  children,
  ...rest
}: LinkProps) {
  return (
    <Link className={`${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`} {...rest}>
      {leading}
      {children}
    </Link>
  );
}
