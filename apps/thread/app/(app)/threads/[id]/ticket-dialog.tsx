'use client';

// Ticket price editor — popup over the Pricing tab's ticket list
// (thethread-v3 model: a LIST of ticket prices, each opening this dialog).

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import type { Locale } from '@thefibre/shared';
import { t } from '@/lib/i18n-ui';
import { createTicket, updateTicket, deleteTicket, type TicketRow } from '../actions';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { FormError } from '@/components/ui/form-error';
import { TextField, TextAreaField, SelectField } from '@/components/ui/field';
import { DateTimeField } from '@/components/ui/date-field';
import { Button } from '@/components/ui/button';
import { SwitchField } from '@/components/ui/switch';

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
  locale,
  threadId,
  ticket,
  onClose,
  onSaved,
}: {
  locale: Locale;
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

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name') ?? '').trim();
    if (!name) return setError(t(locale, 'err_ticket_name'));
    const price = Number(String(fd.get('price') ?? '0').replace(',', '.'));
    if (Number.isNaN(price) || price < 0) return setError(t(locale, 'err_price'));
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
      return setError(t(locale, 'err_keep_one_or_inherit'));
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
      title={isNew ? t(locale, 'add_ticket') : t(locale, 'edit_item', { title: ticket.name })}
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
                {t(locale, 'delete')}
              </Button>
            </div>
          )}
          {error && <FormError message={error} />}
          <Button type="button" variant="secondary" onClick={onClose}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form="ticket-form" disabled={pending}>
            {pending ? t(locale, 'saving') : isNew ? t(locale, 'add_ticket') : t(locale, 'save')}
          </Button>
        </>
      }
    >
      <form id="ticket-form" onSubmit={onSubmit} className="space-y-4">
        <TextField label={t(locale, 'name')} name="name" defaultValue={ticket?.name ?? ''} required />
        <TextAreaField
          label={t(locale, 'description')}
          name="description"
          rows={2}
          defaultValue={ticket?.description ?? ''}
        />
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label={t(locale, 'price')}
            name="price"
            inputMode="decimal"
            placeholder="0.00"
            defaultValue={ticket ? (ticket.price_cents / 100).toFixed(2) : ''}
            hint={t(locale, 'price_hint')}
          />
          <SelectField
            label={t(locale, 'currency')}
            name="price_currency"
            defaultValue={ticket?.price_currency ?? 'EUR'}
            options={CURRENCIES}
          />
        </div>
        <TextField
            label={t(locale, 'quantity_limit')}
            name="quantity_limit"
            type="number"
            min={1}
            placeholder={t(locale, 'no_limit')}
            defaultValue={ticket?.quantity_limit ?? ''}
            hint={t(locale, 'unlimited_hint')}
          />
        <DateTimeField
          label={t(locale, 'available_until')}
          name="available_until"
          defaultValue={toLocalInput(ticket?.available_until ?? null)}
          hint={t(locale, 'keep_available_hint')}
        />
        <div>
          <span className="text-xs text-ink-subtle">{t(locale, 'payment_options')}</span>
          <div className="mt-1.5 flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-ink-subtle cursor-pointer">
              <input type="radio" name="pm-mode-ticket" checked={!pmCustom} onChange={() => setPmCustom(false)} />
              {t(locale, 'inherit')}
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-ink-subtle cursor-pointer">
              <input type="radio" name="pm-mode-ticket" checked={pmCustom} onChange={() => setPmCustom(true)} />
              {t(locale, 'custom_ticket')}
            </label>
            {pmCustom && (
              <span className="inline-flex items-center gap-4">
                <label className="inline-flex items-center gap-1.5 text-sm text-ink-subtle cursor-pointer">
                  <input type="checkbox" checked={pmStripe} onChange={(e) => setPmStripe(e.target.checked)} />
                  {t(locale, 'pay_online')}
                </label>
                <label className="inline-flex items-center gap-1.5 text-sm text-ink-subtle cursor-pointer">
                  <input type="checkbox" checked={pmInvoice} onChange={(e) => setPmInvoice(e.target.checked)} />
                  {t(locale, 'pay_per_invoice')}
                </label>
              </span>
            )}
          </div>
        </div>

        <div className="pt-1">
          <SwitchField
            label={t(locale, 'active_shown')}
            name="is_active"
            defaultChecked={ticket?.is_active ?? true}
          />
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={doDelete}
        title={t(locale, 'delete_ticket')}
        message={
          <>
            {t(locale, 'delete_q_1')} <strong>{ticket?.name}</strong>
            {t(locale, 'delete_q_2')}
          </>
        }
        confirmLabel={t(locale, 'delete')}
        destructive
        pending={pending}
      />
    </Dialog>
  );
}
