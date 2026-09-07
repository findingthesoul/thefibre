// Pricing — the real tiers, told honestly. Numbers come from the SAME
// catalogue the product gates on (GET /api/v1/public/plans, already in
// sortPlans order; Enterprise's id is `org`) — the brief's source-of-truth
// rule: marketing must never hold its own copy of prices.

import type { Metadata } from 'next';
import { eur, feePhrase, isPoa, loadPlans, type CataloguePlan } from '@/lib/plans';
import { StartButton } from '@/components/start-dialog';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Free means free — one live event, forever. Starter €19, Pro €49, Enterprise is a conversation.',
};

export const revalidate = 300;

const LEAD: Record<string, string> = {
  free: 'One live event, forever. Not a trial — a promise.',
  starter: 'A few journeys running at once, in your own voice.',
  pro: 'Design your own threads. The whole workshop, no enrolment fee.',
  org: 'Many teams, one fabric. Let’s talk about what you’re weaving.',
};

function price(p: CataloguePlan): string {
  if (isPoa(p)) return 'Talk to us';
  if (p.price_cents_month === 0) return '€0';
  return `${eur(p.price_cents_month)} / month`;
}

function yearLine(p: CataloguePlan): string | null {
  if (isPoa(p) || p.price_cents_month === 0 || p.price_cents_year === null) return null;
  return `${eur(p.price_cents_year)} / year — two months free`;
}

export default async function PricingPage() {
  const { plans } = await loadPlans();

  return (
    <main className="px-6 py-16 md:px-10 md:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Pricing</h1>
        <p className="mt-4 text-lg text-ink-subtle">
          Per workspace, not per person. Start free, stay free — pay when the work grows.
        </p>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-ink-muted">
          We keep prices as low as we can — this should be affordable for the people doing the
          weaving. And they&apos;re not zero, because the work isn&apos;t: a fair price is what
          keeps the tools developed, hosted and cared for.
        </p>
      </div>

      {plans.length === 0 ? (
        <div className="mx-auto mt-16 max-w-md rounded-2xl border border-line bg-surface-warm p-8 text-center">
          <p className="text-base font-medium">The price list is having a moment.</p>
          <p className="mt-2 text-sm text-ink-subtle">
            Refresh in a minute, or just{' '}
            <Link href="/contact" className="underline underline-offset-4">
              ask us
            </Link>
            — the numbers are simple: free to start, €19, €49, and a conversation.
          </p>
        </div>
      ) : (
        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => {
            const pro = p.id === 'pro';
            return (
              <div
                key={p.id}
                className={`flex flex-col rounded-2xl p-7 ${
                  pro ? 'bg-accent' : 'border border-line bg-surface'
                }`}
              >
                <h2 className="text-lg font-bold">{p.name}</h2>
                <p className="mt-2 text-2xl font-semibold tracking-tight">{price(p)}</p>
                {yearLine(p) && <p className="mt-1 text-xs text-ink-subtle">{yearLine(p)}</p>}
                <p className={`mt-4 flex-1 text-sm leading-relaxed ${pro ? 'text-ink/80' : 'text-ink-subtle'}`}>
                  {LEAD[p.id] ?? ''}
                </p>
                <p className="mt-4 text-xs text-ink-muted">
                  {p.included_seats === null
                    ? 'Seats as you need them'
                    : `${p.included_seats} ${p.included_seats === 1 ? 'seat' : 'seats'} included`}
                  {' · '}
                  {feePhrase(p.meet_paid_pct, p.meet_paid_cap_cents)}
                </p>
                {isPoa(p) ? (
                  <a
                    href="/contact"
                    className={`mt-6 rounded-full px-5 py-2.5 text-center text-sm font-bold transition-all hover:-translate-y-px ${
                      pro ? 'bg-ink text-white hover:shadow-lg' : 'border border-ink text-ink hover:bg-ink hover:text-white'
                    }`}
                  >
                    Talk to us
                  </a>
                ) : (
                  <StartButton
                    plan={p.id}
                    className={`mt-6 w-full rounded-full px-5 py-2.5 text-center text-sm font-bold transition-all hover:-translate-y-px ${
                      pro ? 'bg-ink text-white hover:shadow-lg' : 'border border-ink text-ink hover:bg-ink hover:text-white'
                    }`}
                  >
                    Start a Thread
                  </StartButton>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mx-auto mt-16 max-w-2xl space-y-4 text-sm leading-relaxed text-ink-subtle">
        <p>
          <strong className="text-ink">The enrolment fee, plainly.</strong> When guests pay for a
          ticket, the platform keeps a small share: 2% on Free, 1% on Starter, nothing on Pro and
          above. Your price is your price — the fee comes out of it, never on top of it.
        </p>
        <p>
          <strong className="text-ink">Card payments carry Stripe&apos;s own cost.</strong>{' '}
          Payments run through Stripe, and Stripe charges its standard processing fee on each card
          transaction. That fee is theirs, not ours — we add nothing to it, and invoice-based
          payment avoids it entirely.
        </p>
        <p>
          <strong className="text-ink">Fair use.</strong> Every plan includes a fair-use allowance
          for the things that cost us real money — emails sent and gigabytes stored. Ordinary use
          never touches the ceiling; if a workspace consistently runs far beyond it, we&apos;ll
          talk with you before anything changes.
        </p>
        <p>
          <strong className="text-ink">Ready-made shapes.</strong> Start from ready-made event
          shapes — two on Free, five on Starter, and on Pro your own designs join them: Single
          event, Two-day event, Guided event, Workshop series, Conversation circle.
        </p>
        <p>
          <strong className="text-ink">No surprises.</strong> Annual billing is simply two months
          free. Extra seats are added when you invite someone past your allowance — you approve the
          cost before it happens.
        </p>
        <p>
          Want every number side by side?{' '}
          <a href="https://thefibre.app/pricing" className="underline underline-offset-4 hover:text-ink">
            The full comparison lives here.
          </a>
        </p>
      </div>
    </main>
  );
}
