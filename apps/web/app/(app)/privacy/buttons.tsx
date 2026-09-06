'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { TextAreaField } from '@/components/ui/field';
import { revokeConsent, requestErasure } from './actions';
import { t, type Locale } from '@/lib/i18n-ui';

export function RevokeButton({
  purposeCode,
  label,
  locale,
}: {
  purposeCode: string;
  label: string;
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {t(locale, 'revoke')}
      </Button>
      <ConfirmDialog
        open={open}
        title={t(locale, 'revoke_consent')}
        message={t(locale, 'revoke_consent_msg', { label })}
        confirmLabel={t(locale, 'revoke')}
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

export function ExportButton({ locale }: { locale: Locale }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch('/privacy/export', { cache: 'no-store' });
      if (!res.ok) {
        setError(t(locale, 'export_failed', { status: res.status }));
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
        {pending ? t(locale, 'preparing') : t(locale, 'download_my_data')}
      </Button>
      {error && (
        <div className="mt-2 text-xs text-rose-700">{error}</div>
      )}
    </div>
  );
}

export function ErasureButton({ locale }: { locale: Locale }) {
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
        {t(locale, 'request_erasure')}
      </Button>
      <Dialog
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={t(locale, 'request_erasure')}
        description={t(locale, 'erasure_dialog_desc')}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              {t(locale, 'cancel')}
            </Button>
            <Button variant="danger" onClick={submit} disabled={pending}>
              {pending ? t(locale, 'filing') : t(locale, 'file_request')}
            </Button>
          </>
        }
      >
        <TextAreaField
          label={t(locale, 'notes_optional')}
          name="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t(locale, 'erasure_notes_ph')}
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
