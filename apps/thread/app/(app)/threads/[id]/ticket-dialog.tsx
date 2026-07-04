'use client';

// Ticket price editor — popup over the Pricing tab's ticket list
// (thethread-v3 model: a LIST of ticket prices, each opening this dialog).

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { createTicket, updateTicket, deleteTicket, type TicketRow } from '../actions';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { TextField, TextAreaField, SelectField } from '@/components/ui/field';
import { DateTimeField } from '@/components/ui/date-field';
import { Button } from '@/components/ui/button';

const CURRENCIES = [
  { value: 'EUR', label: 'EUR €' },
  { value: 'USD', label: 'USD $' },
  { value: 'GBP', label: 'GBP £' },
];

// House rule: quantity is a curated dropdown, never a free-form input.
const QUANTITY_OPTIONS = ['10', '20', '50', '100', '200', '500'];

/** ISO → "YYYY-MM-DDTHH:mm" for the date-time picker in the browser's zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): string | null {
  if (!v) return null;
  return new Date(v).toISOString();
}

export function TicketDialog({
  threadId,
  ticket,
  onClose,
  onSaved,
}: {
  threadId: string;
  ticket: TicketRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !ticket;
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Payment options: null = inherit (thread → account default).
  const [pmCustom, setPmCustom] = useState<boolean>(!!ticket?.payment_methods?.length);
  const [pmStripe, setPmStripe] = useState(ticket?.payment_methods?.includes('stripe') ?? true);
  const [pmInvoice, setPmInvoice] = useState(ticket?.payment_methods?.includes('invoice') ?? false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Splice a pre-existing limit into the curated list so editing doesn't lose it.
  const currentLimit = ticket?.quantity_limit ? String(ticket.quantity_limit) : '';
  const quantityOptions = [
    { value: '', label: 'No limit' },
    ...(currentLimit && !QUANTITY_OPTIONS.includes(currentLimit)
      ? [...QUANTITY_OPTIONS, currentLimit].sort((a, b) => Number(a) - Number(b))
      : QUANTITY_OPTIONS
    ).map((q) => ({ value: q, label: `${q} max` })),
  ];

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name') ?? '').trim();
    if (!name) return setError('Give the ticket a name.');
    const price = Number(String(fd.get('price') ?? '0').replace(',', '.'));
    if (Number.isNaN(price) || price < 0) return setError('Price must be 0 or more.');
    const limit = String(fd.get('quantity_limit') ?? '');

    const payload = {
      name,
      description: String(fd.get('description') ?? '').trim() || null,
      price_cents: Math.round(price * 100),
      price_currency: String(fd.get('price_currency') ?? 'EUR'),
      quantity_limit: limit ? Number(limit) : null,
      available_until: fromLocalInput(String(fd.get('available_until') ?? '')),
      is_active: fd.get('is_active') === 'on',
      payment_methods: pmCustom
        ? ([
            ...(pmStripe ? (['stripe'] as const) : []),
            ...(pmInvoice ? (['invoice'] as const) : []),
          ] as ('stripe' | 'invoice')[])
        : null,
    };
    if (pmCustom && payload.payment_methods && payload.payment_methods.length === 0) {
      return setError('Keep at least one payment option on, or switch back to inherit.');
    }

    startTransition(async () => {
      const r = isNew
        ? await createTicket(threadId, payload)
        : await updateTicket(threadId, ticket.id, payload);
      if (!r.ok) return setError(r.error);
      onSaved();
    });
  }

  function doDelete() {
    if (!ticket) return;
    startTransition(async () => {
      const r = await deleteTicket(threadId, ticket.id);
      setConfirmDelete(false);
      if (!r.ok) return setError(r.error);
      onSaved();
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={isNew ? 'Add ticket' : `Edit — ${ticket.name}`}
      footer={
        <>
          {!isNew && (
            <div className="mr-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leading={<Trash2 size={14} />}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            </div>
          )}
          {error && <span className="text-sm text-red-700 truncate max-w-xs">{error}</span>}
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="ticket-form" disabled={pending}>
            {pending ? 'Saving…' : isNew ? 'Add ticket' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="ticket-form" onSubmit={onSubmit} className="space-y-4">
        <TextField label="Name" name="name" defaultValue={ticket?.name ?? ''} required />
        <TextAreaField
          label="Description"
          name="description"
          rows={2}
          defaultValue={ticket?.description ?? ''}
        />
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label="Price"
            name="price"
            inputMode="decimal"
            placeholder="0.00"
            defaultValue={ticket ? (ticket.price_cents / 100).toFixed(2) : ''}
            hint="0 = free ticket."
          />
          <SelectField
            label="Currency"
            name="price_currency"
            defaultValue={ticket?.price_currency ?? 'EUR'}
            options={CURRENCIES}
          />
        </div>
        <TextField
            label="Quantity limit"
            name="quantity_limit"
            type="number"
            min={1}
            placeholder="No limit"
            defaultValue={ticket?.quantity_limit ?? ''}
            hint="Leave empty for unlimited."
          />
        <DateTimeField
          label="Available until"
          name="available_until"
          defaultValue={toLocalInput(ticket?.available_until ?? null)}
          hint="Leave empty to keep it available."
        />
        <div>
          <span className="text-xs text-ink-subtle">Payment options</span>
          <div className="mt-1.5 flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-ink-subtle cursor-pointer">
              <input type="radio" name="pm-mode-ticket" checked={!pmCustom} onChange={() => setPmCustom(false)} />
              Inherit
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-ink-subtle cursor-pointer">
              <input type="radio" name="pm-mode-ticket" checked={pmCustom} onChange={() => setPmCustom(true)} />
              Custom for this ticket
            </label>
            {pmCustom && (
              <span className="inline-flex items-center gap-4">
                <label className="inline-flex items-center gap-1.5 text-sm text-ink-subtle cursor-pointer">
                  <input type="checkbox" checked={pmStripe} onChange={(e) => setPmStripe(e.target.checked)} />
                  Pay online
                </label>
                <label className="inline-flex items-center gap-1.5 text-sm text-ink-subtle cursor-pointer">
                  <input type="checkbox" checked={pmInvoice} onChange={(e) => setPmInvoice(e.target.checked)} />
                  Pay per invoice
                </label>
              </span>
            )}
          </div>
        </div>

        <label className="flex items-center gap-2.5 pt-1">
          <input type="checkbox" name="is_active" defaultChecked={ticket?.is_active ?? true} />
          <span className="text-sm text-ink-subtle">Active — shown at enrolment</span>
        </label>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={doDelete}
        title="Delete ticket"
        message={
          <>
            Delete <strong>{ticket?.name}</strong>? This can&apos;t be undone.
          </>
        }
        confirmLabel="Delete"
        destructive
        pending={pending}
      />
    </Dialog>
  );
}
