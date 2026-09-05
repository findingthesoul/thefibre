'use client';

// Add-participant popup — walk-ins, phone signups (Sjoerd 2026-07-04),
// grown a billing choice (Sjoerd 2026-09-05: "adding people manually to a
// course that is actually paid should be an ask to send an invoice").
// Paid threads default to Invoice: the person is enrolled pending payment
// and a house-style invoice is emailed (with a Pay-online button when the
// organiser has Stripe connected). Comped keeps today's free add. The
// amount always comes from the chosen ticket, resolved server-side.

import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { TextField, SelectField } from '@/components/ui/field';
import { SwitchField } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  addThreadParticipant,
  getThreadPricing,
  type ThreadPricing,
} from './registrations-actions';

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(cents / 100);
}

export function AddParticipantDialog({
  threadId,
  onClose,
  onAdded,
}: {
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
      setError('Already enrolled — no changes made.');
      setBusy(false);
      return;
    }
    onAdded(
      r.invoicePending
        ? 'Added with a pending invoice — mark it paid once the money arrives.'
        : r.reactivated
          ? 'Re-activated an earlier registration — the person is enrolled again.'
          : null,
    );
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add participant"
      description={
        invoiceable
          ? 'This thread is paid — manual adds are invoiced by email, or comped.'
          : 'Adds the person directly as enrolled.'
      }
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="add-participant-form" disabled={busy || pricing === null}>
            {busy ? 'Adding…' : 'Add participant'}
          </Button>
        </>
      }
    >
      <form id="add-participant-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextField label="Name" name="name" required autoFocus />
          <TextField label="Email" name="email" type="email" required />
        </div>

        {pricing === null && (
          <div className="h-10 rounded-md border border-line bg-surface-sunken/50 animate-pulse" />
        )}

        {tickets.length > 0 && (
          <SelectField
            label="Ticket"
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value)}
            options={tickets.map((t) => ({
              value: t.id,
              label: `${t.name} — ${t.price_cents > 0 ? money(t.price_cents, t.price_currency) : 'Free'}`,
            }))}
            hint="Sets the invoice amount."
          />
        )}

        {pricing !== null && invoiceable && (
          <div>
            <label className="block text-sm font-medium mb-1">Billing</label>
            <div className="space-y-1.5 rounded-md border border-line bg-surface-sunken p-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="billing"
                  className="mt-0.5"
                  checked={billing === 'invoice'}
                  onChange={() => setBilling('invoice')}
                />
                <span>
                  <span className="font-medium">Invoice · {money(amountCents, currency)}</span>
                  <span className="block text-xs text-ink-muted">
                    Emails a pending invoice now — pay by transfer or the pay-online link. The
                    confirmation email follows once it&apos;s paid.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="billing"
                  className="mt-0.5"
                  checked={billing === 'comped'}
                  onChange={() => setBilling('comped')}
                />
                <span>
                  <span className="font-medium">Comped / free</span>
                  <span className="block text-xs text-ink-muted">
                    No invoice — the person is enrolled right away.
                  </span>
                </span>
              </label>
            </div>
          </div>
        )}

        {!invoiced && (
          <SwitchField
            label="Send the confirmation email and welcome messages"
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
