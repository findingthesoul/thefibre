'use client';

// Deciding a cancellation request (Sjoerd's 2iv, 2026-10-16), opened from the
// badge on a registration. The participant's reason, then:
//   · Approve — the place is released (Decline's own path); on a card place
//     "Refund €x to their card" is offered and, ticked, goes through the same
//     Reimburse as the invoices page. An invoice place gets no refund here:
//     that money moved outside Stripe, and the dialog says so.
//   · Decline — the place stays; the note, if any, goes to the participant.
// The dialog bottom-bar contract: the destructive choice left, Cancel and the
// main action right.

import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SwitchField } from '@/components/ui/switch';
import { TextAreaField } from '@/components/ui/field';
import { NOTICE } from '@thefibre/shared/ui/recipes';
import { money } from '@thefibre/shared/money';
import { INTL_LOCALES, type Locale } from '@thefibre/shared';
import { t } from '@/lib/i18n-ui';
import { approveCancellation, rejectCancellation, type CancellationRequestItem } from './registrations-actions';

export function CancellationDialog({
  locale,
  request,
  personName,
  onClose,
  onDecided,
}: {
  locale: Locale;
  request: CancellationRequestItem;
  personName: string;
  onClose: () => void;
  /** After a decision: the parent reloads its lists. */
  onDecided: () => void;
}) {
  const [refund, setRefund] = useState(!!request.refundable);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // An approval whose refund failed: the place IS released; say what to do.
  const [refundFailed, setRefundFailed] = useState<string | null>(null);
  const amount = request.refundable
    ? money(request.refundable.amount_cents, request.refundable.currency, INTL_LOCALES[locale])
    : null;

  async function approve() {
    setBusy(true);
    setError(null);
    const r = await approveCancellation(request.id, !!request.refundable && refund);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    if (r.refund_error) {
      setRefundFailed(r.refund_error);
      onDecided();
      return;
    }
    onDecided();
    onClose();
  }

  async function reject() {
    setBusy(true);
    setError(null);
    const r = await rejectCancellation(request.id, note.trim() || null);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    onDecided();
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(locale, 'cancel_req_title')}
      description={personName}
      footer={
        refundFailed ? (
          <Button type="button" onClick={onClose}>
            {t(locale, 'close')}
          </Button>
        ) : (
          <>
            <Button type="button" variant="danger" className="mr-auto" onClick={reject} disabled={busy}>
              {t(locale, 'cancel_req_reject')}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              {t(locale, 'cancel')}
            </Button>
            <Button type="button" onClick={approve} disabled={busy}>
              {t(locale, 'cancel_req_approve')}
            </Button>
          </>
        )
      }
    >
      {refundFailed ? (
        <p className={NOTICE.warning}>{t(locale, 'cancel_req_refund_failed', { error: refundFailed })}</p>
      ) : (
        <>
          <p className="text-sm text-ink-subtle">{t(locale, 'cancel_req_reason')}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{request.reason || t(locale, 'cancel_req_no_reason')}</p>

          <div className="mt-5">
            {amount ? (
              <SwitchField
                label={t(locale, 'cancel_req_refund', { amount })}
                checked={refund}
                onChange={setRefund}
              />
            ) : (
              <p className="text-sm text-ink-subtle">{t(locale, 'cancel_req_no_card')}</p>
            )}
          </div>

          <div className="mt-5">
            <TextAreaField
              label={t(locale, 'cancel_req_note')}
              value={note}
              maxLength={2000}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        </>
      )}
    </Dialog>
  );
}
