'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { TextAreaField } from '@/components/ui/field';
import { revokeConsent, requestErasure } from './actions';

export function RevokeButton({ purposeCode, label }: { purposeCode: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Revoke
      </Button>
      <ConfirmDialog
        open={open}
        title="Revoke consent"
        message={`Stop allowing ${label}? You can grant it again later.`}
        confirmLabel="Revoke"
        destructive
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          start(async () => {
            await revokeConsent(purposeCode);
            setOpen(false);
          })
        }
      />
    </>
  );
}

export function ExportButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch('/privacy/export', { cache: 'no-store' });
      if (!res.ok) {
        setError(`Export failed (${res.status}). Try again or contact support.`);
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const filename = match?.[1] ?? `fibre-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <Button variant="primary" onClick={download} disabled={pending}>
        {pending ? 'Preparing…' : 'Download my data'}
      </Button>
      {error && (
        <div className="mt-2 text-xs text-rose-700">{error}</div>
      )}
    </div>
  );
}

export function ErasureButton() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    start(async () => {
      const res = await requestErasure(notes.trim() || null);
      if (res.error) setError(res.error);
      else {
        setOpen(false);
        setNotes('');
      }
    });
  }

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Request erasure
      </Button>
      <Dialog
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Request erasure"
        description="GDPR Article 17. We'll respond within 30 days. Some structural records may be retained for referential integrity — content fields are zeroed."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="danger" onClick={submit} disabled={pending}>
              {pending ? 'Filing…' : 'File request'}
            </Button>
          </>
        }
      >
        <TextAreaField
          label="Notes (optional)"
          name="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything you want us to know about this request."
        />
        {error && (
          <div className="mt-3 rounded-md border border-line bg-surface-sunken p-3 text-sm text-ink-subtle">
            {error}
          </div>
        )}
      </Dialog>
    </>
  );
}
