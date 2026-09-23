'use client';

// THE canonical Dialog — one implementation, six apps (extracted 2026-09-05,
// component-inventory Phase 1 from the flow/pulse/membership superset, itself
// ported from The Thread's — the pinned Fibre SPoT: footer bar outside the
// scroll area; destructive left, Cancel · Save right).

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './button.js';
import { chromeT, useLocale } from './i18n-ui.js';
import { dismissThreshold, dragOffset } from './dialog-swipe.js';

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
  /**
   * Small icon actions at the end of the title line, just before the close
   * button — e.g. "open the full profile". Icons with a `title` tooltip, not
   * buttons with words: the header is one line. Added 2026-09-14.
   */
  headerActions?: ReactNode;
};

const SIZES: Record<NonNullable<Props['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-xl',
  // The v3 editor width — roomy, two-column-friendly.
  xl: 'max-w-3xl',
};

export function Dialog({ open, onClose, title, description, children, footer, size = 'md', headerActions }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const locale = useLocale();

  // ── Swipe the sheet down to close ─────────────────────────────────────────
  //
  // Sjoerd, 2026-09-24, on the portal's ticket sheet: "To slide the window
  // down, you need to click X. Why not also slide down on a swipe from the top
  // bar?" On a phone this is a bottom sheet, and a bottom sheet you cannot
  // push away is one that does not behave like the rest of the phone.
  //
  // THE HEADER ONLY, and that is the whole design rather than a shortcut. The
  // body scrolls; a drag handler on it has to guess every time whether a
  // downward finger means "scroll up" or "dismiss", and guesses wrong at the
  // top of the list. The header never scrolls, so there is nothing to
  // disambiguate — which is also exactly where he said to put it.
  //
  // Touch only. A mouse drag on a desktop dialog is not a gesture anyone
  // makes, and the sheet is a centred card there anyway.
  const [drag, setDrag] = useState(0);
  const startY = useRef<number | null>(null);

  function onTouchStart(e: React.TouchEvent) {
    startY.current = e.touches[0]?.clientY ?? null;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startY.current === null) return;
    const dy = (e.touches[0]?.clientY ?? 0) - startY.current;
    // Downward only. Dragging UP would lift the sheet off the bottom of the
    // screen and show the page behind it, which looks like a bug.
    setDrag(dragOffset(dy));
  }

  function onTouchEnd() {
    const height = ref.current?.getBoundingClientRect().height ?? 0;
    const threshold = dismissThreshold(height);
    startY.current = null;
    if (drag > threshold) onClose();
    // Reset either way: on close the sheet unmounts, and if it does not close
    // it must spring back rather than stay where the finger left it.
    setDrag(0);
  }

  // Escape closes. NOTE FOR ANYONE PUTTING A LAYER ON TOP OF THIS DIALOG:
  // the listener is on `document` in the BUBBLE phase, and listeners on the
  // same node fire in REGISTRATION order. This dialog opens first, so it
  // registers first, so it wins — and no amount of stopPropagation from a
  // later bubble listener can get in front of it.
  //
  // The symptom when that bites points away from the cause: pressing Escape
  // with an overlay open closes the dialog UNDERNEATH and leaves the overlay
  // stranded over the page with its parent gone. Found in the visitor
  // portal's enlarged check-in code, 2026-09-09, and it cost an hour.
  //
  // A layer above must listen in the CAPTURE phase on the same node —
  // capture runs before every bubble listener there — and call
  // `stopImmediatePropagation` so the key never reaches this handler at all.
  // See apps/my/app/detail.tsx for the worked example.
  // A sheet reopened after a half-drag must start where it belongs.
  useEffect(() => {
    if (open) setDrag(0);
  }, [open]);

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
      // `fixed`, and NOT in a portal — which is a live footgun worth knowing
      // about before you place a dialog. An ancestor with `opacity` below 1,
      // a `transform` or a `filter` becomes the containing block for a fixed
      // descendant, so the dialog stops covering the viewport and starts
      // covering that ancestor; opacity also fades it. It happened on
      // 2026-09-21: Connect dimmed a past agenda row with `opacity-55` and
      // this dialog came up translucent, laid over the list.
      //
      // The fix at the call site is to render the dialog OUTSIDE the faded
      // subtree — one dialog for a list rather than one per row — which is
      // better anyway. Moving this into a portal would fix the class of bug
      // for every app and is a bigger change than it looks (focus, event
      // bubbling, the app's CSS scope); it is in docs/build-plan.md.
      //
      // Mobile: a bottom sheet (full width, rounded top, safe-area padding).
      // ≥sm: the centred card it always was.
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-ink/40"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`relative ${SIZES[size]} w-full rounded-t-xl sm:rounded-lg bg-surface-raised border border-line shadow-xl flex flex-col max-h-[92dvh] sm:max-h-[85vh] pb-[env(safe-area-inset-bottom)] sm:pb-0 ${
          drag > 0 ? '' : 'transition-transform'
        }`}
        // No transition WHILE dragging — the sheet must sit under the finger,
        // not lag behind it. The class comes back on release so it springs.
        style={drag > 0 ? { transform: `translateY(${drag}px)` } : undefined}
      >
        <header
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
          className="flex items-start justify-between gap-4 px-5 pt-4 pb-4 border-b border-line touch-none select-none sm:touch-auto sm:select-auto"
        >
          {/* The grab handle — a phone affordance, so it is hidden from ≥sm
              where the dialog is a centred card and there is nothing to
              push. It is what tells someone the gesture exists at all. */}
          <span
            aria-hidden
            className="absolute inset-x-0 top-2 mx-auto h-1 w-10 rounded-full bg-line-strong sm:hidden"
          />
          <div className="min-w-0">
            <h2 className="text-base font-medium">{title}</h2>
            {/* A div, not a p: a description may be a row of links. */}
            {description && <div className="mt-0.5 text-sm text-ink-subtle">{description}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {headerActions}
            <button
              onClick={onClose}
              className="text-ink-muted hover:text-ink"
              aria-label={chromeT(locale, 'close')}
            >
              <X size={18} strokeWidth={1.75} />
            </button>
          </div>
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
