'use client';

// The built-in integration's settings: how Fibre-seat grants provision
// (Sjoerd, 2026-09-05: "the company needs to auto accept or approve — and
// needs to approve that it pays per seat above the plan").

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { saveSeatPolicy } from './actions';

export function SeatPolicyCard({
  mode: initialMode,
  allowBilled: initialAllowBilled,
}: {
  mode: 'auto' | 'approve';
  allowBilled: boolean;
}) {
  const [mode, setMode] = useState<'auto' | 'approve'>(initialMode);
  const [allowBilled, setAllowBilled] = useState(initialAllowBilled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const r = await saveSeatPolicy({ fibre_seat_mode: mode, allow_billed_seats: allowBilled });
    setBusy(false);
    if (r.error) setError(r.error);
    else {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <div className="p-5 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">When a tier grants a seat</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as 'auto' | 'approve')}
          className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm focus:border-line-strong focus:outline-none"
        >
          <option value="approve">Wait for approval — each seat needs an Approve click on the member</option>
          <option value="auto">Automatic — seats within the plan allowance provision on their own</option>
        </select>
      </div>
      <label className="flex items-start gap-2.5 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={allowBilled}
          onChange={(e) => setAllowBilled(e.target.checked)}
          className="mt-0.5 accent-ink"
        />
        <span>
          <span className="text-ink">Seats above the plan allowance may be billed</span>
          <span className="block text-xs text-ink-muted">
            Standing consent: extra seats are charged on your Fibre subscription (prorated when
            added; a lapsed member&apos;s seat stops billing from the next period). Without this,
            a seat that would cost money always waits for approval.
          </span>
        </span>
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-ink-muted">Saved.</p>}
      <Button type="button" onClick={save} disabled={busy}>
        {busy ? 'Saving…' : 'Save seat policy'}
      </Button>
    </div>
  );
}
