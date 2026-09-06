'use client';

// THE canonical Dialog — one implementation, six apps (extracted 2026-09-05,
// component-inventory Phase 1 from the flow/pulse/membership superset, itself
// ported from The Thread's — the pinned Fibre SPoT: footer bar outside the
// scroll area; destructive left, Cancel · Save right).

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './button.js';
import { chromeT, useLocale } from './i18n-ui.js';

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  // Footer is rendered to the right; supply your own buttons. It sits
  // outside the scroll area, so it behaves as a sticky save bar (v3 style).
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
};

const SIZES: Record<NonNullable<Props['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-xl',
  // The v3 editor width — roomy, two-column-friendly.
  xl: 'max-w-3xl',
};

export function Dialog({ open, onClose, title, description, children, footer, size = 'md' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const locale = useLocale();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      // Mobile: a bottom sheet (full width, rounded top, safe-area padding).
      // ≥sm: the centred card it always was.
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-ink/40"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`${SIZES[size]} w-full rounded-t-xl sm:rounded-lg bg-surface-raised border border-line shadow-xl flex flex-col max-h-[92dvh] sm:max-h-[85vh] pb-[env(safe-area-inset-bottom)] sm:pb-0`}
      >
        <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-line">
          <div>
            <h2 className="text-base font-medium">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-ink-subtle">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink"
            aria-label={chromeT(locale, 'close')}
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </header>
        <div className={`overflow-y-auto ${size === 'xl' ? 'px-7 py-6' : 'px-5 py-4'}`}>
          {children}
        </div>
        {footer && (
          <footer className="px-5 py-3 border-t border-line flex items-center justify-end gap-2">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

type ConfirmProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: ReactNode;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
};

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  pending = false,
}: ConfirmProps) {
  const locale = useLocale();
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            {cancelLabel ?? chromeT(locale, 'cancel')}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? chromeT(locale, 'working') : (confirmLabel ?? chromeT(locale, 'confirm'))}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-subtle">{message}</p>
    </Dialog>
  );
}
