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
import { TextAreaField, TextField } from '@/components/ui/field';
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
  // What goes back (refund rules, slice 3a): the rule's answer by default,
  // capped at what is left; editable, with a reason when it differs.
  const quote = request.refund_quote && request.refund_quote.reason !== 'no_rule' ? request.refund_quote : null;
  const remaining = request.refundable?.remaining_cents ?? request.refundable?.amount_cents ?? 0;
  const ruleCents = quote ? Math.min(quote.refund_cents, remaining) : remaining;
  const [amountText, setAmountText] = useState((ruleCents / 100).toFixed(2));
  const [why, setWhy] = useState('');
  const amountCents = Math.round(Number(amountText.replace(',', '.')) * 100);
  const amountOk = Number.isFinite(amountCents) && amountCents >= 0 && amountCents <= remaining;
  const differs = !!quote && amountCents !== ruleCents;
  const [noteNumber, setNoteNumber] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // An approval whose refund failed: the place IS released; say what to do.
  const [refundFailed, setRefundFailed] = useState<string | null>(null);
  const amount = request.refundable
    ? money(request.refundable.amount_cents, request.refundable.currency, INTL_LOCALES[locale])
    : null;

  async function approve() {
    setError(null);
    if (request.refundable && refund) {
      if (!amountOk) return setError(t(locale, 'cancel_req_amount_bad', { max: money(remaining, request.refundable.currency, INTL_LOCALES[locale]) }));
      if (differs && !why.trim()) return setError(t(locale, 'cancel_req_reason_needed'));
    }
    setBusy(true);
    const r = await approveCancellation(
      request.id,
      request.refundable && refund && amountCents > 0 ? { amount_cents: amountCents, reason: differs ? why.trim() : null } : null,
    );
    setBusy(false);
    if (!r.ok) return setError(r.error);
    if (r.refund_error) {
      setRefundFailed(r.refund_error);
      onDecided();
      return;
    }
    if (r.credit_note) {
      // Until the credit note is mailed (slice 3b), the organiser sees its number.
      setNoteNumber(r.credit_note.number);
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
        refundFailed || noteNumber ? (
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
      ) : noteNumber ? (
        <p className={NOTICE.success}>{t(locale, 'cancel_req_refunded_note', { number: noteNumber })}</p>
      ) : (
        <>
          <p className="text-sm text-ink-subtle">{t(locale, 'cancel_req_reason')}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{request.reason || t(locale, 'cancel_req_no_reason')}</p>

          {/* What the refund RULE says (refund rules, slice 2), counted at the
              day they asked. Information only: the switch below still does
              exactly what it did — a full refund or none — until partial
              refunds ship, so nothing here suggests an amount the button
              would not pay (coordinator, 2026-10-17). */}
          {request.refund_quote && request.refund_quote.reason !== 'no_rule' && (
            <div className={`mt-5 ${NOTICE.info}`}>
              <p>
                {t(locale, 'cancel_req_rule_quote', {
                  amount: money(request.refund_quote.refund_cents, request.refund_quote.currency, INTL_LOCALES[locale]),
                  pct: String(request.refund_quote.pct),
                  date: new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(request.refund_quote.counted_at)),
                })}
                {request.refund_quote.fee_cents > 0 &&
                  ` ${t(locale, 'cancel_req_rule_fee', { fee: money(request.refund_quote.fee_cents, request.refund_quote.currency, INTL_LOCALES[locale]) })}`}
              </p>

            </div>
          )}

          <div className="mt-5">
            {amount ? (
              <div className="space-y-3">
                <SwitchField label={t(locale, 'cancel_req_refund_to_card')} checked={refund} onChange={setRefund} />
                {refund && (
                  <>
                    <div className="w-48">
                      <TextField
                        label={t(locale, 'cancel_req_amount')}
                        hint={t(locale, 'cancel_req_amount_hint', { max: money(remaining, request.refundable!.currency, INTL_LOCALES[locale]) })}
                        inputMode="decimal"
                        value={amountText}
                        onChange={(e) => setAmountText(e.target.value)}
                      />
                    </div>
                    {differs && (
                      <TextAreaField
                        label={t(locale, 'cancel_req_why_differs')}
                        value={why}
                        maxLength={500}
                        onChange={(e) => setWhy(e.target.value)}
                      />
                    )}
                  </>
                )}
              </div>
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
