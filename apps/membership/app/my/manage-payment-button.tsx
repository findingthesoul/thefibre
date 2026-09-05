'use client';

// "Manage payment" — opens the Stripe Billing Portal on the community's
// connected account. Members without a Stripe subscription (manual/comped)
// get a quiet note instead: there is nothing in Stripe for them to manage.

import { useState } from 'react';
import { browserSupabase } from '@/lib/supabase/client';
import { t, type Locale } from '@/lib/i18n';

export function ManagePaymentButton({
  memberId,
  hasStripe,
  locale = 'en',
}: {
  memberId: string;
  hasStripe: boolean;
  /** Resolved server-side by the page (Thread pattern) — never from cookies. */
  locale?: Locale;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!hasStripe) {
    return <p className="text-xs text-ink-muted">{t(locale, 'managed_by_community')}</p>;
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
        setError(t(locale, 'session_expired'));
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
        setNote(t(locale, 'managed_by_community'));
        return;
      }
      if (!res.ok) {
        setError(t(locale, 'portal_error'));
        return;
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch {
      setError(t(locale, 'portal_error'));
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
        {busy ? t(locale, 'opening') : t(locale, 'manage_payment')}
      </button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
