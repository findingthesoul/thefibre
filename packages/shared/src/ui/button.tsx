// THE canonical Button — one implementation, six apps (extracted 2026-09-05,
// component-inventory Phase 1; the per-app copies were byte-identical except
// web, which lacked the `icon` size — this is the superset).
//
// `ButtonLink` needs next/link, and this package keeps no Next.js dependency
// (same arrangement as HelpPage in help.tsx): each app's
// components/ui/button.tsx shim calls `createButtonLink(Link)` with the real
// next/link at module scope and re-exports the result.

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'save';
type Size = 'sm' | 'md' | 'icon';

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-line-strong';

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-9 px-4 text-sm',
  icon: 'h-9 w-9 text-sm',
};

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-ink-inverse hover:opacity-90',
  // The yellow of the switches and of the website's "Start a Thread". Dark
  // text on it in both themes: yellow does not invert.
  save: 'bg-yellow-400 text-neutral-900 hover:bg-yellow-300',
  secondary: 'border border-line bg-surface-raised text-ink hover:bg-surface-sunken',
  ghost: 'text-ink-subtle hover:text-ink hover:bg-surface-sunken',
  danger:
    'border border-red-300 bg-red-50 text-red-800 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/40 dark:hover:bg-red-950/50',
};

export function buttonClassName(variant: Variant, size: Size, className = ''): string {
  return `${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`;
}

/**
 * Saving is yellow (Sjoerd, 2026-09-14: "the whole app — for SAVE when SAVE is
 * an option or needed: Yellow/Orange please").
 *
 * Decided by what the button DOES, not by its label: a primary button that
 * submits a form is committing something, so it wears the save colour without
 * every call site having to remember. Counted across all apps before choosing
 * this: primary submit buttons are Save / Save changes in 43 places and Create /
 * Add in most of the rest — all of them commits. Primary buttons that do not
 * submit (Check people in, Issue certificate, a link styled as a button) stay
 * ink, so yellow keeps meaning "this saves". `variant="save"` exists for the
 * odd save button that is not a form submit.
 */
function resolveVariant(variant: Variant, type: string | undefined): Variant {
  return variant === 'primary' && type === 'submit' ? 'save' : variant;
}

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
      className={buttonClassName(resolveVariant(variant, rest.type), size, className)}
      {...rest}
    >
      {leading}
      {children}
    </button>
  );
});

/** next/link, structurally. See HelpLink in help.tsx for why it is loose. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LinkLike = (props: any) => any;

type ButtonLinkOwnProps = {
  variant?: Variant;
  size?: Size;
  leading?: ReactNode;
  className?: string;
  children?: ReactNode;
};

/** Bind the app's next/link once, at module scope, in the shim:
 *  `export const ButtonLink = createButtonLink(Link);` */
export function createButtonLink<P extends { className?: string | undefined }>(LinkComponent: LinkLike) {
  return function ButtonLink({
    variant = 'primary',
    size = 'md',
    leading,
    className = '',
    children,
    ...rest
  }: Omit<P, 'className' | 'children'> & ButtonLinkOwnProps) {
    return (
      <LinkComponent className={buttonClassName(variant, size, className)} {...rest}>
        {leading}
        {children}
      </LinkComponent>
    );
  };
}
