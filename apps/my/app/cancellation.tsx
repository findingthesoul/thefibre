'use client';

// "Request cancellation" on a thread you hold a place in (Sjoerd's 2iv,
// 2026-10-16). A request, not a cancellation: the organiser decides, and
// about any refund too. The API offers the button (`can_request_cancellation`)
// by the same rules it refuses by, so it is never offered and then refused.
//
// Four states, read from the payload:
//   · offered        → the button, then a dialog with an optional reason;
//   · pending        → "Cancellation requested" and a way to withdraw it;
//   · approved       → the place is cancelled;
//   · rejected       → the organiser's answer and note (and the button again,
//                      when the API still offers it).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@thefibre/shared/ui/button';
import { TextAreaField } from '@thefibre/shared/ui/fields';
import { FormError } from '@thefibre/shared/ui/form-error';
import { requestCancellation, withdrawCancellation, type ThreadItem } from '@/lib/portal-api';
import { fmtDate } from '@/lib/format';

export function CancellationSection({ thread }: { thread: ThreadItem }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const req = thread.cancellation_request ?? null;
  const id = thread.enrolment_id ?? null;
  if (!id || (!req && !thread.can_request_cancellation)) return null;

  async function send() {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await requestCancellation(id, reason.trim() || null);
      setOpen(false);
      setReason('');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await withdrawCancellation(id);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 border-t border-line pt-4">
      {req?.status === 'pending' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink">
            Cancellation requested on {fmtDate(req.created_at)}. The organiser will let you know.
          </p>
          <Button type="button" variant="secondary" onClick={withdraw} disabled={busy}>
            Withdraw request
          </Button>
        </div>
      )}
      {req?.status === 'approved' && <p className="text-sm text-ink">Your place was cancelled at your request.</p>}
      {req?.status === 'rejected' && (
        <div className="text-sm text-ink">
          <p>The organiser kept your place.</p>
          {req.decision_note && <p className="mt-1 whitespace-pre-wrap text-ink-subtle">{req.decision_note}</p>}
        </div>
      )}
      {thread.can_request_cancellation && req?.status !== 'pending' && !open && (
        <div className={req ? 'mt-3' : ''}>
          <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
            Request cancellation
          </Button>
        </div>
      )}
      {error && !open && <FormError message={error} />}

      {/* INLINE, not a second dialog: this sits inside the thread sheet,
          and a dialog over a dialog is the Escape-closes-the-wrong-layer
          trap detail.tsx already documents. */}
      {open && (
        <div className="mt-3 rounded-xl border border-line p-4">
          <p className="text-sm text-ink">
            The organiser decides. Until they do, your place stays yours. If you paid, they also decide about a
            refund.
          </p>
          <div className="mt-3">
            <TextAreaField
              label="Reason (optional)"
              value={reason}
              maxLength={2000}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          {error && <FormError message={error} />}
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" onClick={send} disabled={busy}>
              Send request
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
