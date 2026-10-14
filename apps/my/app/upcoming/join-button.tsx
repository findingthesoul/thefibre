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

type Outcome =
  | { kind: 'in' }
  | { kind: 'already' }
  | { kind: 'invoice' }
  | { kind: 'closed'; membership: boolean }
  | { kind: 'pending' }
  | { kind: 'error'; message: string; pageHelps: boolean };

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
        already_enrolled?: boolean;
        invoice_open?: boolean;
        place_closed?: boolean;
        place_closed_reason?: 'membership_ended' | 'organiser';
      };
      if (!res.ok) {
        const message = sentenceFor(res.status, body.error);
        // The thread's page only helps when it offers something this button
        // cannot — an invoice. When nobody can take the money, the page has
        // the same dead end on it, so it is not offered.
        setOutcome({ kind: 'error', message, pageHelps: /by invoice/.test(message) });
        return;
      }
      if (body.checkout_url) {
        // Arrived is not paid: the place is held as pending until Stripe
        // confirms, exactly as on the thread's own page.
        window.location.href = body.checkout_url;
        return;
      }
      // already_enrolled: the enrol route found a place this person already
      // holds and changed nothing. Saying "You're in" there would claim a
      // join that did not happen.
      setOutcome(
        body.invoice_open
          ? { kind: 'invoice' }
          : body.place_closed
          ? { kind: 'closed', membership: body.place_closed_reason === 'membership_ended' }
          : body.already_enrolled
          ? { kind: 'already' }
          : body.pending_approval
            ? { kind: 'pending' }
            : { kind: 'in' },
      );
      // The thread is now one of theirs: it leaves this list and appears
      // under Next. Refresh so both say so.
      router.refresh();
    } catch {
      setOutcome({ kind: 'error', message: 'Could not reach the server. Try again.', pageHelps: false });
    } finally {
      setBusy(false);
    }
  }

  if (outcome?.kind === 'in') {
    return <p className={`${NOTICE.success} mt-3`}>You’re in. It is under Next now.</p>;
  }
  if (outcome?.kind === 'already') {
    return (
      <p className={`${NOTICE.info} mt-3`}>You’re already signed up for this one. It is under Next.</p>
    );
  }
  if (outcome?.kind === 'invoice') {
    // Unpaid, with an invoice already issued: a card payment now would be a
    // second payment beside a numbered invoice. The invoice is under
    // Purchases, with its Pay link when the organiser sent one.
    return (
      <p className={`${NOTICE.info} mt-3`}>
        You have an open invoice for this one.{' '}
        <a href="/purchases" className="underline underline-offset-2">
          See it under Purchases
        </a>
        .
      </p>
    );
  }
  if (outcome?.kind === 'closed') {
    // The organiser ended this place (a decline, or a membership place
    // withdrawn). Signing up again does not reopen it; only they can.
    // Two causes, two sentences: "closed by the organiser" is simply untrue
    // for a place that went because a membership ended.
    return (
      <p className={`${NOTICE.info} mt-3`}>
        {outcome.membership
          ? 'Your place on this one came with a membership that has ended. Contact the organiser if you would like to join.'
          : 'Your place on this one is closed. Contact the organiser if you would like to join.'}
      </p>
    );
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
          {outcome.message}
          {outcome.pageHelps && (
            <>
              {' '}
              <a href={j.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                Open its page
              </a>
              .
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** The API's words are for developers, lowercase and terse. A member gets a
 *  sentence — the known refusals mapped, anything else said plainly. */
function sentenceFor(status: number, error: unknown): string {
  const raw = typeof error === 'string' ? error : '';
  const known: [RegExp, string][] = [
    [/not connected payments|payments are not configured/i, 'Sign-up is not open yet: the organiser cannot take payments.'],
    [/payment method is not available/i, 'This one cannot be paid by card. Sign up on its page to pay by invoice.'],
    [/full/i, 'This one is full.'],
    [/sold out/i, 'This ticket is sold out.'],
    [/closed/i, 'Sign-up for this one has closed.'],
    [/too many attempts/i, 'Too many tries in a short time. Wait a few minutes and try again.'],
    [/privacy policy/i, 'Tick the privacy statement to join.'],
    [/sign in required/i, 'Your session ended. Sign in again to join.'],
  ];
  for (const [pattern, sentence] of known) if (pattern.test(raw)) return sentence;
  return status >= 500 ? 'Something went wrong on our side. Try again in a moment.' : 'Could not join this one.';
}
