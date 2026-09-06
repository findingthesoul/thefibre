'use client';

// Add-participant popup — walk-ins, phone signups (Sjoerd 2026-07-04),
// grown a billing choice (Sjoerd 2026-09-05: "adding people manually to a
// course that is actually paid should be an ask to send an invoice").
// Paid threads default to Invoice: the person is enrolled pending payment
// and a house-style invoice is emailed (with a Pay-online button when the
// organiser has Stripe connected). Comped keeps today's free add. The
// amount always comes from the chosen ticket, resolved server-side.

import { useEffect, useState } from 'react';
import { BillingChoice } from '@thefibre/shared/ui/billing-choice';
import { INTL_LOCALES, type Locale } from '@thefibre/shared';
import { t } from '@/lib/i18n-ui';
import { Dialog } from '@/components/ui/dialog';
import { TextField, SelectField } from '@/components/ui/field';
import { SwitchField } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  addThreadParticipant,
  getThreadPricing,
  type ThreadPricing,
} from './registrations-actions';

function money(locale: Locale, cents: number, currency: string): string {
  return new Intl.NumberFormat(INTL_LOCALES[locale], { style: 'currency', currency }).format(
    cents / 100,
  );
}

export function AddParticipantDialog({
  locale,
  threadId,
  onClose,
  onAdded,
}: {
  locale: Locale;
  threadId: string;
  onClose: () => void;
  /** Called after a successful add; `info` is a note for the parent list. */
  onAdded: (info: string | null) => void;
}) {
  const [pricing, setPricing] = useState<ThreadPricing | null>(null);
  const [billing, setBilling] = useState<'invoice' | 'comped'>('invoice');
  const [ticketId, setTicketId] = useState('');
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getThreadPricing(threadId).then((r) => {
      if (cancelled) return;
      // A failed pricing load degrades to the free/comped form — the server
      // resolves the real price anyway and refuses a priceless invoice.
      const p: ThreadPricing = r.ok
        ? r.pricing
        : { price_cents: null, price_currency: null, tickets: [] };
      setPricing(p);
      setTicketId(p.tickets[0]?.id ?? '');
    });
    return () => {
      cancelled = true;
    };
  }, [threadId]);

  const tickets = pricing?.tickets ?? [];
  const chosen = tickets.find((t) => t.id === ticketId) ?? null;
  // Tickets are the price source when they exist; else the legacy price.
  const amountCents = chosen ? chosen.price_cents : (pricing?.price_cents ?? 0);
  const currency = chosen?.price_currency ?? pricing?.price_currency ?? 'EUR';
  const invoiceable = amountCents > 0;
  const invoiced = invoiceable && billing === 'invoice';

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name') ?? '').trim();
    const email = String(fd.get('email') ?? '').trim();
    if (!name || !email) return;
    setBusy(true);
    setError(null);
    const r = await addThreadParticipant(threadId, {
      name,
      email,
      notify,
      billing: invoiced ? 'invoice' : 'comped',
      ticket_id: invoiced && chosen ? chosen.id : null,
    });
    if (!r.ok) {
      setError(r.error);
      setBusy(false);
      return;
    }
    if (r.already) {
      setError(t(locale, 'already_enrolled_no_changes'));
      setBusy(false);
      return;
    }
    onAdded(
      r.invoicePending
        ? t(locale, 'added_invoice_pending')
        : r.reactivated
          ? t(locale, 'reactivated_msg')
          : null,
    );
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(locale, 'add_participant')}
      description={
        invoiceable
          ? t(locale, 'add_participant_paid_desc')
          : t(locale, 'add_participant_free_desc')
      }
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form="add-participant-form" disabled={busy || pricing === null}>
            {busy ? t(locale, 'adding') : t(locale, 'add_participant')}
          </Button>
        </>
      }
    >
      <form id="add-participant-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextField label={t(locale, 'name')} name="name" required autoFocus />
          <TextField label={t(locale, 'email')} name="email" type="email" required />
        </div>

        {pricing === null && (
          <div className="h-10 rounded-md border border-line bg-surface-sunken/50 animate-pulse" />
        )}

        {tickets.length > 0 && (
          <SelectField
            label={t(locale, 'ticket')}
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value)}
            options={tickets.map((tk) => ({
              value: tk.id,
              label: `${tk.name} — ${
                tk.price_cents > 0
                  ? money(locale, tk.price_cents, tk.price_currency)
                  : t(locale, 'free')
              }`,
            }))}
            hint={t(locale, 'ticket_hint')}
          />
        )}

        {pricing !== null && invoiceable && (
          <BillingChoice
            value={billing}
            onChange={setBilling}
            invoiceLabel={t(locale, 'invoice_amount_label', {
              amount: money(locale, amountCents, currency),
            })}
            invoiceDescription={t(locale, 'invoice_manual_desc')}
            compedLabel={t(locale, 'comped_label')}
            compedDescription={t(locale, 'comped_desc')}
          />
        )}

        {!invoiced && (
          <SwitchField
            label={t(locale, 'send_confirmation')}
            name="notify"
            checked={notify}
            onChange={setNotify}
          />
        )}

        {error && <p className="text-sm text-red-700">{error}</p>}
      </form>
    </Dialog>
  );
}
