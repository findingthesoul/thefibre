'use client';

// "Discount code?" — the reveal, the field and the applied state.
//
// Written in The Thread's enrol form and lifted here when the membership join
// panel needed the same thing. New recurring surfaces are born in
// @thefibre/shared with the app-bound pieces injected as props (the
// ui/invoices.tsx pattern): what differs between the two forms is WHERE a
// code is validated and what the strings are, so both arrive as props and
// nothing about the shape is duplicated.
//
// It validates SERVER-SIDE through `onValidate`, always. A discount decided in
// a browser is a discount anybody can decide, and the route that charges
// re-validates from scratch regardless — the number here is a courtesy.

import { useState, type ReactNode } from 'react';

export type DiscountCodeResult =
  | { ok: true; code: string }
  /** Shown as given. The server decides the wording, because only it knows
   *  whether a code is unknown, expired, used up or for something else. */
  | { ok: false; reason: string };

export function DiscountCodeField({
  onValidate,
  onCleared,
  labels,
  inputClassName,
  /** A line under the applied state — for a subscription, that the code
   *  applies to the first payment only. Omitted where it would be noise. */
  note,
}: {
  onValidate: (code: string) => Promise<DiscountCodeResult>;
  /** Called when the field is edited after a code was applied, so the form
   *  can drop the discounted price it was showing. A stale price beside a
   *  changed code is the one thing this must never leave on screen. */
  onCleared?: () => void;
  labels: { label: ReactNode; apply: ReactNode; applied: (code: string) => ReactNode };
  inputClassName: string;
  note?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [applied, setApplied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function apply() {
    const code = value.trim();
    if (!code || checking) return;
    setChecking(true);
    setError(null);
    try {
      const r = await onValidate(code);
      if (r.ok) {
        setApplied(r.code);
      } else {
        setApplied(null);
        onCleared?.();
        setError(r.reason);
      }
    } catch {
      // A network failure is not "your code is wrong" — saying so would send
      // somebody hunting for a typo that is not there.
      setApplied(null);
      onCleared?.();
      setError('We could not check that code just now. Try again in a moment.');
    } finally {
      setChecking(false);
    }
  }

  if (!open && !applied) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-ink-subtle underline underline-offset-2 hover:text-ink"
      >
        {labels.label}?
      </button>
    );
  }

  return (
    <div>
      <span className="text-xs text-ink-subtle">{labels.label}</span>
      <div className="mt-1 flex gap-2">
        <input
          name="discount_code"
          value={value}
          onChange={(e) => {
            setValue(e.target.value.toUpperCase());
            if (applied) {
              setApplied(null);
              onCleared?.();
            }
            setError(null);
          }}
          onKeyDown={(e) => {
            // Enter applies the code; without this it submits the whole form
            // and charges somebody the undiscounted price.
            if (e.key === 'Enter') {
              e.preventDefault();
              void apply();
            }
          }}
          className={`${inputClassName} mt-0 font-mono uppercase`}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => void apply()}
          disabled={checking || !value.trim()}
          className="shrink-0 h-9 px-3 rounded-md border border-line text-sm text-ink-subtle hover:text-ink hover:bg-surface-sunken disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {labels.apply}
        </button>
      </div>
      {applied && (
        <>
          <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-400">
            {labels.applied(applied)}
          </p>
          {note && <p className="mt-1 text-xs text-ink-subtle">{note}</p>}
        </>
      )}
      {error && <p className="mt-1.5 text-xs text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}
