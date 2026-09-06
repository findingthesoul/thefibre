'use client';

// The app-wide destructive-action confirm (Sjoerd 2026-07-02): one popup,
// one rule — you type DELETE to arm the button. Single point of truth for
// every hard delete in the Fibre apps. Extraction phase 2: the per-app
// copies ("copy this file, don't reinvent it") now live HERE.

import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Dialog } from './dialog.js';
import { Button } from './button.js';
import { chromeT, useLocale } from './i18n-ui.js';

export function DangerConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  pending = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: React.ReactNode;
  message: React.ReactNode;
  confirmLabel?: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const locale = useLocale();
  const [typed, setTyped] = useState('');
  // The armed keyword stays the literal DELETE in every locale — the copy
  // around it translates; the word you type does not.
  const armed = typed.trim().toUpperCase() === 'DELETE';
  // "Type {word} to confirm" — {word} is styled, so split around it.
  const [typeBefore, typeAfter] = chromeT(locale, 'danger_type_to_confirm').split('{word}');

  function close() {
    setTyped('');
    onCancel();
  }

  if (!open) return null;

  return (
    <Dialog
      open
      onClose={close}
      title={
        <span className="inline-flex items-center gap-2">
          <TriangleAlert size={17} strokeWidth={1.75} className="text-red-600" />
          {title}
        </span>
      }
      footer={
        <>
          <Button type="button" variant="secondary" onClick={close}>
            {chromeT(locale, 'cancel')}
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={!armed || pending}
            onClick={() => {
              onConfirm();
              setTyped('');
            }}
          >
            {pending ? chromeT(locale, 'deleting') : (confirmLabel ?? chromeT(locale, 'delete'))}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-subtle leading-relaxed">{message}</p>
        <label className="block">
          <span className="text-xs text-ink-subtle">
            {typeBefore}
            <span className="font-mono font-medium text-ink">DELETE</span>
            {typeAfter}
          </span>
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm font-mono tracking-widest focus:border-red-400 focus:outline-none"
            placeholder="DELETE"
          />
        </label>
      </div>
    </Dialog>
  );
}
