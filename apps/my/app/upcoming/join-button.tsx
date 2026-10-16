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
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import { t, type MyKey } from '@/lib/i18n';
import { parts } from '@/lib/i18n-parts';

type Outcome =
  | { kind: 'in' }
  | { kind: 'already' }
  | { kind: 'invoice' }
  | { kind: 'closed'; membership: boolean }
  | { kind: 'pending' }
  | { kind: 'error'; message: MyKey; pageHelps: boolean };

export function JoinButton({ j }: { j: CouldJoin }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // One id per attempt, kept across a retry: the enrol route is idempotent
  // on it, so a double tap or a retried request joins once.
  const [requestId] = useState(() => crypto.randomUUID());
  const locale = useLocale();

  const policy = POLICIES.find((p) => p.required);
  const priceWord =
    j.your_price_cents === 0
      ? t(locale, 'join')
      : t(locale, 'join_for', { price: money(j.your_price_cents, j.currency, locale) });

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
        setOutcome({ kind: 'error', message, pageHelps: message === 'join_err_invoice_only' });
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
      setOutcome({ kind: 'error', message: 'join_err_network', pageHelps: false });
    } finally {
      setBusy(false);
    }
  }

  if (outcome?.kind === 'in') {
    return <p className={`${NOTICE.success} mt-3`}>{t(locale, 'join_in')}</p>;
  }
  if (outcome?.kind === 'already') {
    return (
      <p className={`${NOTICE.info} mt-3`}>{t(locale, 'join_already')}</p>
    );
  }
  if (outcome?.kind === 'invoice') {
    // Unpaid, with an invoice already issued: a card payment now would be a
    // second payment beside a numbered invoice. The invoice is under
    // Purchases, with its Pay link when the organiser sent one.
    return (
      <p className={`${NOTICE.info} mt-3`}>
        {parts(t(locale, 'join_invoice'), {
          link: (
            <a href="/purchases" className="underline underline-offset-2">
              {t(locale, 'join_invoice_link')}
            </a>
          ),
        })}
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
          ? t(locale, 'join_closed_membership')
          : t(locale, 'join_closed')}
      </p>
    );
  }
  if (outcome?.kind === 'pending') {
    return (
      <p className={`${NOTICE.info} mt-3`}>
        {t(locale, 'join_pending')}
      </p>
    );
  }

  if (!open) {
    return (
      <Button size="sm" variant="secondary" className="mt-3" onClick={() => setOpen(true)}>
        {t(locale, 'join')}
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
            {parts(t(locale, 'agree_privacy'), {
              link: (
                <a href={policy.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  {t(locale, 'privacy_statement')}
                </a>
              ),
            })}
          </span>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy || (!!policy && !agreed)} onClick={join}>
          {busy ? t(locale, 'joining') : priceWord}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
          {t(locale, 'cancel')}
        </Button>
      </div>
      {outcome?.kind === 'error' && (
        <div className={NOTICE.error}>
          {t(locale, outcome.message)}
          {outcome.pageHelps && (
            <>
              {' '}
              <a href={j.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                {t(locale, 'open_its_page')}
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
 *  sentence — the known refusals mapped, anything else said plainly — as a
 *  catalog KEY, so it is said in the reader's language. */
function sentenceFor(status: number, error: unknown): MyKey {
  const raw = typeof error === 'string' ? error : '';
  const known: [RegExp, MyKey][] = [
    [/not connected payments|payments are not configured/i, 'join_err_no_payments'],
    [/payment method is not available/i, 'join_err_invoice_only'],
    [/full/i, 'join_err_full'],
    [/sold out/i, 'join_err_sold_out'],
    [/closed/i, 'join_err_closed'],
    [/too many attempts/i, 'join_err_too_many'],
    [/privacy policy/i, 'join_err_privacy'],
    [/sign in required/i, 'join_err_session'],
  ];
  for (const [pattern, key] of known) if (pattern.test(raw)) return key;
  return status >= 500 ? 'join_err_server' : 'join_err_generic';
}
