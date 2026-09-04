'use client';

// "Manage payment" — opens the Stripe Billing Portal on the community's
// connected account. Members without a Stripe subscription (manual/comped)
// get a quiet note instead: there is nothing in Stripe for them to manage.

import { useState } from 'react';
import { browserSupabase } from '@/lib/supabase/client';

const MANAGED_NOTE =
  'This membership is managed by the community — contact them to make changes.';

export function ManagePaymentButton({
  memberId,
  hasStripe,
}: {
  memberId: string;
  hasStripe: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!hasStripe) {
    return <p className="text-xs text-ink-muted">{MANAGED_NOTE}</p>;
  }
  if (note) {
    return <p className="text-xs text-ink-muted">{note}</p>;
  }

  async function openPortal() {
    setBusy(true);
    setError(null);
    try {
      const supabase = browserSupabase();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError('Your session expired — reload the page and sign in again.');
        return;
      }
      const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
      const res = await fetch(`${base}/api/v1/membership/portal/me/portal-session`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ member_id: memberId }),
      });
      if (res.status === 409) {
        setNote(MANAGED_NOTE);
        return;
      }
      if (!res.ok) {
        setError('Could not open the payment portal — try again shortly.');
        return;
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch {
      setError('Could not open the payment portal — try again shortly.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={openPortal}
        disabled={busy}
        className="rounded-md border border-line bg-surface-raised px-4 py-1.5 text-sm font-medium text-ink hover:bg-surface-sunken disabled:opacity-50"
      >
        {busy ? 'Opening…' : 'Manage payment'}
      </button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
