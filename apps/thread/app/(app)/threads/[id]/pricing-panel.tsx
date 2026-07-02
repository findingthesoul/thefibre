'use client';

// Pricing tab in thread settings (Sjoerd 2026-07-02). Free/Paid as a
// 2-card chooser (house rule: never a bare select for binary modes).
// Checkout itself lands with the payments phase — the price is stored now.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Gift, CreditCard } from 'lucide-react';
import { updateThread } from '../actions';
import type { ThreadRow } from '@/lib/thread-types';
import { TextField, SelectField } from '@/components/ui/field';
import { Button } from '@/components/ui/button';

const CURRENCIES = [
  { value: 'EUR', label: 'EUR €' },
  { value: 'USD', label: 'USD $' },
  { value: 'GBP', label: 'GBP £' },
];

export function PricingPanel({ thread }: { thread: ThreadRow }) {
  const router = useRouter();
  const [mode, setMode] = useState<'free' | 'paid'>(thread.price_cents ? 'paid' : 'free');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    const price = Number(String(fd.get('price') ?? '0').replace(',', '.'));
    if (mode === 'paid' && (!price || price <= 0)) {
      return setError('Set a price, or switch to Free.');
    }
    startTransition(async () => {
      const r = await updateThread(thread.id, {
        price_cents: mode === 'paid' ? Math.round(price * 100) : null,
        price_currency: mode === 'paid' ? String(fd.get('currency') ?? 'EUR') : null,
      });
      if (!r.ok) return setError(r.error);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ModeCard
          Icon={Gift}
          title="Free"
          desc="Anyone can enrol without paying."
          active={mode === 'free'}
          onClick={() => setMode('free')}
        />
        <ModeCard
          Icon={CreditCard}
          title="Paid"
          desc="Enrolment goes through checkout. Payouts land with the payments phase."
          active={mode === 'paid'}
          onClick={() => setMode('paid')}
        />
      </div>

      {mode === 'paid' && (
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label="Price"
            name="price"
            inputMode="decimal"
            placeholder="49.00"
            defaultValue={thread.price_cents ? (thread.price_cents / 100).toFixed(2) : ''}
          />
          <SelectField
            label="Currency"
            name="currency"
            defaultValue={thread.price_currency ?? 'EUR'}
            options={CURRENCIES}
          />
        </div>
      )}

      {error && (
        <p className="text-sm text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save pricing'}
        </Button>
        {saved && <span className="text-sm text-ink-subtle">Saved.</span>}
      </div>
    </form>
  );
}

function ModeCard({
  Icon,
  title,
  desc,
  active,
  onClick,
}: {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  title: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border p-3.5 transition-colors ${
        active ? 'border-ink bg-surface-sunken' : 'border-line bg-surface hover:bg-surface-sunken'
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon size={15} strokeWidth={1.75} className="text-ink-subtle" />
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="mt-1 text-xs text-ink-subtle leading-relaxed">{desc}</p>
    </button>
  );
}
