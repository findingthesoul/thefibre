'use client';

// "Manage payment" — opens the Stripe Billing Portal on the COMMUNITY's
// connected account, because that is where the subscription lives, not on
// the platform account.
//
// This is the control the portal plan says must not be lost when
// `membership.thethread.app/my` retires into this surface: a redirect that
// quietly drops your card-change screen is worse than having two pages. It
// exists here first, and the redirect comes after.
//
// Members without a Stripe subscription (manual, comped, invoiced) get a
// sentence instead of a button: there is nothing in Stripe for them to
// manage, and the endpoint would only ever 409.

import { useState } from 'react';
import { browserSupabase } from '@/lib/supabase/client';

export function ManagePayment({
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
    return (
      <p className="mt-3 text-xs text-ink-muted">
        Your community handles the payments for this one.
      </p>
    );
  }
  if (note) return <p className="mt-3 text-xs text-ink-muted">{note}</p>;

  async function openPortal() {
    setBusy(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await browserSupabase().auth.getSession();
      if (!session) {
        setError('Your session expired. Sign in again.');
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
        setNote('Your community handles the payments for this one.');
        return;
      }
      if (!res.ok) {
        setError('That did not open. Try again in a moment.');
        return;
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch {
      setError('That did not open. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={openPortal}
        disabled={busy}
        className="inline-flex min-h-11 items-center rounded-lg border border-line bg-surface px-4 text-sm text-ink hover:border-line-strong disabled:opacity-50"
      >
        {busy ? 'Opening…' : 'Manage payment'}
      </button>
      {error && <p className="mt-1 text-xs text-ink-muted">{error}</p>}
    </div>
  );
}
