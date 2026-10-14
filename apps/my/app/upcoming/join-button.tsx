'use client';

// Join, from the list, in two taps: one to open the confirmation, one to
// join. The confirmation is not ceremony — it is where the privacy statement
// is agreed to, which the enrol route records on the enrolment and which must
// never be pre-ticked (GDPR), and it says the price once more beside the
// button that commits to it.
//
// Everything after the click is the enrol route's decision, said back in
// words: a place, a request waiting on the organiser, or a card payment
// (Stripe's page, then back to the thread's page).

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { POLICIES } from '@thefibre/shared';
import { Button } from '@thefibre/shared/ui/button';
import { NOTICE } from '@thefibre/shared/ui/recipes';
import type { CouldJoin } from '@/lib/portal-api';
import { money } from '@/lib/format';

type Outcome = { kind: 'in' } | { kind: 'pending' } | { kind: 'error'; message: string };

export function JoinButton({ j }: { j: CouldJoin }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // One id per attempt, kept across a retry: the enrol route is idempotent
  // on it, so a double tap or a retried request joins once.
  const [requestId] = useState(() => crypto.randomUUID());

  const policy = POLICIES.find((p) => p.required);
  const priceWord =
    j.your_price_cents === 0 ? 'Join' : `Join for ${money(j.your_price_cents, j.currency)}`;

  async function join() {
    setBusy(true);
    setOutcome(null);
    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_slug: j.owner_slug,
          thread_slug: j.thread_slug,
          request_id: requestId,
          policy_accepted: agreed,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: unknown;
        checkout_url?: string;
        pending_approval?: boolean;
      };
      if (!res.ok) {
        setOutcome({
          kind: 'error',
          message: typeof body.error === 'string' ? body.error : 'Could not join — try again.',
        });
        return;
      }
      if (body.checkout_url) {
        // Arrived is not paid: the place is held as pending until Stripe
        // confirms, exactly as on the thread's own page.
        window.location.href = body.checkout_url;
        return;
      }
      setOutcome(body.pending_approval ? { kind: 'pending' } : { kind: 'in' });
      // The thread is now one of theirs: it leaves this list and appears
      // under Next. Refresh so both say so.
      router.refresh();
    } catch {
      setOutcome({ kind: 'error', message: 'Could not reach the server — try again.' });
    } finally {
      setBusy(false);
    }
  }

  if (outcome?.kind === 'in') {
    return <p className={`${NOTICE.success} mt-3`}>You’re in. It is under Next now.</p>;
  }
  if (outcome?.kind === 'pending') {
    return (
      <p className={`${NOTICE.info} mt-3`}>
        Asked. The organiser confirms places for this one, and you will get an email when they do.
      </p>
    );
  }

  if (!open) {
    return (
      <Button size="sm" variant="secondary" className="mt-3" onClick={() => setOpen(true)}>
        Join
      </Button>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {policy && (
        <label className="flex min-h-11 items-start gap-2 text-sm text-ink-subtle">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1"
          />
          <span>
            I agree to the{' '}
            <a href={policy.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              privacy statement
            </a>
            .
          </span>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy || (!!policy && !agreed)} onClick={join}>
          {busy ? 'Joining…' : priceWord}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {outcome?.kind === 'error' && (
        <div className={NOTICE.error}>
          {outcome.message}{' '}
          <a href={j.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            Sign up on its page instead
          </a>
          .
        </div>
      )}
    </div>
  );
}
