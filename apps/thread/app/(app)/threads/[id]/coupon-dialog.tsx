'use client';

// Discount-code editor — popup over the Pricing tab's coupon list
// (thethread-v3 model). Type is a 3-segment toggle (house rule: never a
// bare select for small closed sets) with a consequential value field.

import { useState, useTransition } from 'react';
import { Trash2, Percent, Coins, Gift } from 'lucide-react';
import {
  createCoupon,
  updateCoupon,
  deleteCoupon,
  type CouponRow,
  type TicketRow,
} from '../actions';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { TextField, SelectField } from '@/components/ui/field';
import { DateTimeField } from '@/components/ui/date-field';
import { Button } from '@/components/ui/button';

type CouponType = CouponRow['type'];

// The API returns/accepts ticket_id on coupons; the shared row type predates it.
export type ScopedCouponRow = CouponRow & { ticket_id?: string | null };

// House rule: usage limit is a curated dropdown, never a free-form input.
const USAGE_OPTIONS = ['10', '25', '50', '100', '250'];

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

export function CouponDialog({
  threadId,
  coupon,
  tickets,
  onClose,
  onSaved,
}: {
  threadId: string;
  coupon: ScopedCouponRow | null;
  tickets: TicketRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !coupon;
  const [type, setType] = useState<CouponType>(coupon?.type ?? 'percentage');
  const [earlyBird, setEarlyBird] = useState(coupon?.is_early_bird ?? false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Splice a pre-existing limit into the curated list so editing doesn't lose it.
  const currentLimit = coupon?.usage_limit ? String(coupon.usage_limit) : '';
  const usageOptions = [
    { value: '', label: 'Unlimited' },
    ...(currentLimit && !USAGE_OPTIONS.includes(currentLimit)
      ? [...USAGE_OPTIONS, currentLimit].sort((a, b) => Number(a) - Number(b))
      : USAGE_OPTIONS
    ).map((u) => ({ value: u, label: `${u} uses` })),
  ];

  const ticketOptions = [
    { value: '', label: 'All tickets' },
    ...tickets.map((t) => ({ value: t.id, label: t.name })),
  ];

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const code = String(fd.get('code') ?? '').trim().toUpperCase();
    if (!code) return setError('Give the code a value.');

    let discount_percentage: number | null = null;
    let discount_amount_cents: number | null = null;
    if (type === 'percentage') {
      const pct = Number(fd.get('discount_percentage') ?? 0);
      if (!pct || pct < 1 || pct > 100) return setError('Percentage must be between 1 and 100.');
      discount_percentage = pct;
    } else if (type === 'amount') {
      const amount = Number(String(fd.get('discount_amount') ?? '0').replace(',', '.'));
      if (!amount || amount <= 0) return setError('Set a discount amount.');
      discount_amount_cents = Math.round(amount * 100);
    }

    const limit = String(fd.get('usage_limit') ?? '');
    const ticketId = String(fd.get('ticket_id') ?? '');
    const payload = {
      code,
      ticket_id: ticketId || null,
      name: String(fd.get('name') ?? '').trim() || null,
      type,
      discount_percentage,
      discount_amount_cents,
      usage_limit: limit ? Number(limit) : null,
      expires_at: fromLocalInput(String(fd.get('expires_at') ?? '')),
      is_early_bird: earlyBird,
      early_bird_deadline: earlyBird
        ? fromLocalInput(String(fd.get('early_bird_deadline') ?? ''))
        : null,
      is_active: fd.get('is_active') === 'on',
    };

    startTransition(async () => {
      const r = isNew
        ? await createCoupon(threadId, payload)
        : await updateCoupon(threadId, coupon.id, payload);
      if (!r.ok) return setError(r.error);
      onSaved();
    });
  }

  function doDelete() {
    if (!coupon) return;
    startTransition(async () => {
      const r = await deleteCoupon(threadId, coupon.id);
      setConfirmDelete(false);
      if (!r.ok) return setError(r.error);
      onSaved();
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={isNew ? 'Add discount code' : `Edit — ${coupon.code}`}
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
          <Button type="submit" form="coupon-form" disabled={pending}>
            {pending ? 'Saving…' : isNew ? 'Add code' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="coupon-form" onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label="Code"
            name="code"
            required
            placeholder="EARLYBIRD"
            defaultValue={coupon?.code ?? ''}
            autoCapitalize="characters"
            style={{ textTransform: 'uppercase' }}
            hint="Uppercased automatically."
          />
          <TextField
            label="Name"
            name="name"
            placeholder="Early bird"
            defaultValue={coupon?.name ?? ''}
          />
        </div>

        {/* Type: 3-segment toggle with the consequential value field */}
        <div>
          <span className="text-sm text-ink-subtle">Type</span>
          <div className="mt-1 grid grid-cols-3 rounded-md border border-line overflow-hidden h-[38px]">
            <ModeButton
              Icon={Percent}
              label="Percentage"
              active={type === 'percentage'}
              onClick={() => setType('percentage')}
            />
            <ModeButton
              Icon={Coins}
              label="Amount"
              active={type === 'amount'}
              onClick={() => setType('amount')}
            />
            <ModeButton
              Icon={Gift}
              label="Free"
              active={type === 'free'}
              onClick={() => setType('free')}
            />
          </div>
        </div>

        {type === 'percentage' && (
          <TextField
            label="Discount"
            name="discount_percentage"
            type="number"
            min={1}
            max={100}
            placeholder="20"
            defaultValue={coupon?.discount_percentage ?? ''}
            hint="Percent off, 1–100."
          />
        )}
        {type === 'amount' && (
          <TextField
            label="Discount amount"
            name="discount_amount"
            inputMode="decimal"
            placeholder="10.00"
            defaultValue={
              coupon?.discount_amount_cents ? (coupon.discount_amount_cents / 100).toFixed(2) : ''
            }
            hint="Fixed amount off, in the ticket's currency."
          />
        )}
        {type === 'free' && (
          <p className="text-xs text-ink-muted rounded-md border border-line bg-surface-sunken/50 px-3 py-2">
            The code makes enrolment free — no charge at checkout.
          </p>
        )}

        <SelectField
          label="Applies to"
          name="ticket_id"
          defaultValue={coupon?.ticket_id ?? ''}
          options={ticketOptions}
          hint="Scope the code to one ticket, or leave it valid for all."
        />

        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Usage limit"
            name="usage_limit"
            defaultValue={currentLimit}
            options={usageOptions}
          />
          <DateTimeField
            label="Expires"
            name="expires_at"
            defaultValue={toLocalInput(coupon?.expires_at ?? null)}
          />
        </div>

        <label className="flex items-center gap-2.5 pt-1">
          <input
            type="checkbox"
            checked={earlyBird}
            onChange={(e) => setEarlyBird(e.target.checked)}
          />
          <span className="text-sm text-ink-subtle">Early bird — only valid until a deadline</span>
        </label>
        {earlyBird && (
          <DateTimeField
            label="Early-bird deadline"
            name="early_bird_deadline"
            defaultValue={toLocalInput(coupon?.early_bird_deadline ?? null)}
          />
        )}

        <label className="flex items-center gap-2.5 pt-1">
          <input type="checkbox" name="is_active" defaultChecked={coupon?.is_active ?? true} />
          <span className="text-sm text-ink-subtle">Active — redeemable at checkout</span>
        </label>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={doDelete}
        title="Delete discount code"
        message={
          <>
            Delete <strong>{coupon?.code}</strong>? This can&apos;t be undone.
          </>
        }
        confirmLabel="Delete"
        destructive
        pending={pending}
      />
    </Dialog>
  );
}

function ModeButton({
  Icon,
  label,
  active,
  onClick,
}: {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 text-sm transition-colors ${
        active
          ? 'bg-ink text-ink-inverse font-medium'
          : 'bg-surface-raised text-ink-subtle hover:text-ink'
      }`}
    >
      <Icon size={14} strokeWidth={1.75} />
      {label}
    </button>
  );
}
