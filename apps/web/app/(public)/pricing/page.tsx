import Link from 'next/link';
import { FEATURE_GROUPS, eur, feePhrase, type CataloguePlan } from '@/lib/plans';

// The public price list. Rendered from GET /api/v1/public/plans — the same
// billing_plan rows the feature gates and the admin matrix use, so this page
// can never promise something enforcement disagrees with.
//
// During the invited trial every CTA leads to /request-access; self-serve
// signup is a later flip, not a rebuild (docs/productisation-proposal.md §3.4).

export const metadata = {
  title: 'Pricing · The Fibre',
  description:
    'Per workspace, not per seat. Free for a community group running one gathering a year; €19 and €49 packages for teams running more.',
};

export const revalidate = 300;

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

const BLURB: Record<string, string> = {
  free: 'For a community group running one gathering a year. Not a trial — stay forever.',
  starter: 'For a small team running events through the year.',
  pro: 'For an operation, not an occasion — with Flow, Pulse and threads you design yourself.',
  org: 'For organisations with their own requirements. A conversation, not a price list.',
};

async function loadPlans(): Promise<CataloguePlan[]> {
  try {
    const r = await fetch(`${apiBase}/api/v1/public/plans`, { next: { revalidate: 300 } });
    if (!r.ok) return [];
    const data = (await r.json()) as { plans: CataloguePlan[] };
    return data.plans ?? [];
  } catch {
    return [];
  }
}

export default async function PricingPage() {
  const plans = await loadPlans();

  return (
    <div className="mt-12">
      <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-600">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-400" />
        The Fibre is in an invited trial — access is by request
      </div>

      <h1 className="mt-6 text-4xl font-medium tracking-tight">Pricing</h1>
      <p className="mt-4 max-w-2xl text-neutral-600 leading-relaxed">
        Per workspace, not per seat. A seat is someone who <em>runs</em> events — participants are
        never seats, and enrolling four hundred people costs nothing per person. Prices ex-VAT.
        Yearly is two months free.
      </p>

      {plans.length === 0 ? (
        <p className="mt-12 text-sm text-neutral-500">
          The price list is having a moment. Try again shortly, or just{' '}
          <Link href="/request-access" className="underline">
            request access
          </Link>
          .
        </p>
      ) : (
        <>
          {/* Tier cards ------------------------------------------------ */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => (
              <div key={p.id} className="flex flex-col rounded-xl border border-neutral-200 p-5">
                <h2 className="text-base font-medium">{p.name}</h2>
                <div className="mt-3">
                  {p.id === 'org' ? (
                    <span className="text-2xl font-medium tracking-tight">Talk to us</span>
                  ) : (
                    <>
                      <span className="text-3xl font-medium tracking-tight">
                        {p.price_cents_month === 0 ? '€0' : eur(p.price_cents_month)}
                      </span>
                      <span className="text-sm text-neutral-500"> /month</span>
                      {p.price_cents_year !== null && p.price_cents_year > 0 && (
                        <div className="mt-0.5 text-xs text-neutral-500">
                          or {eur(p.price_cents_year)}/year — two months free
                        </div>
                      )}
                    </>
                  )}
                </div>
                <p className="mt-3 text-sm text-neutral-600 leading-relaxed">
                  {BLURB[p.id] ?? ''}
                </p>
                <ul className="mt-4 space-y-1.5 text-sm text-neutral-700">
                  <li>
                    {p.included_seats === null
                      ? 'Unlimited seats'
                      : `${p.included_seats} seat${p.included_seats === 1 ? '' : 's'} included`}
                    {p.extra_seat_cents_month ? `, +${eur(p.extra_seat_cents_month)}/extra` : ''}
                  </li>
                  <li>
                    {p.included_emails_month === null
                      ? 'Email negotiated'
                      : `${p.included_emails_month.toLocaleString('en-GB')} emails / month`}
                  </li>
                  <li>
                    Fee on paid enrolments: {feePhrase(p.meet_paid_pct, p.meet_paid_cap_cents)}
                  </li>
                  <li>
                    {p.retention_months
                      ? `Data kept ${p.retention_months} months`
                      : 'Data kept for as long as you pay'}
                  </li>
                </ul>
                <div className="mt-auto pt-5">
                  <Link
                    href={`/request-access?plan=${p.id}`}
                    className={`block rounded-md px-4 py-2 text-center text-sm font-medium ${
                      p.id === 'pro'
                        ? 'bg-neutral-900 text-white hover:bg-neutral-800'
                        : 'border border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    Request access
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Full comparison ------------------------------------------- */}
          <section className="mt-16">
            <h2 className="text-lg font-medium">Everything, side by side</h2>
            <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                    <th className="px-4 py-3 font-normal text-neutral-500" />
                    {plans.map((p) => (
                      <th key={p.id} className="px-4 py-3 font-medium">
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <CompareRow label="Monthly" plans={plans} value={(p) => (p.id === 'org' ? 'Talk to us' : eur(p.price_cents_month))} />
                  <CompareRow label="Yearly (two months free)" plans={plans} value={(p) => (p.id === 'org' ? '—' : p.price_cents_year === 0 ? '€0' : eur(p.price_cents_year))} />
                  <CompareRow label="Seats included" plans={plans} value={(p) => (p.included_seats === null ? 'Unlimited' : String(p.included_seats))} />
                  <CompareRow label="Extra seat" plans={plans} value={(p) => (p.extra_seat_cents_month ? `${eur(p.extra_seat_cents_month)}/month` : '—')} />
                  <CompareRow label="Email / month" plans={plans} value={(p) => (p.included_emails_month === null ? 'Negotiated' : p.included_emails_month.toLocaleString('en-GB'))} />
                  <CompareRow label="Storage" plans={plans} value={(p) => (p.included_storage_gb === null ? 'Negotiated' : `${p.included_storage_gb} GB`)} />
                  <CompareRow label="Data kept" plans={plans} value={(p) => (p.retention_months ? `${p.retention_months} months` : 'While you pay')} />
                  <CompareRow label="Fee on paid enrolments" plans={plans} value={(p) => feePhrase(p.meet_paid_pct, p.meet_paid_cap_cents)} />
                  <CompareRow label="Meet" plans={plans} value={() => '✓'} />
                  {FEATURE_GROUPS.filter((g) => g.rows.length > 0).flatMap((g) =>
                    g.rows.map((row) => (
                      <tr key={row.key} className="border-b border-neutral-100 last:border-0">
                        <td className="px-4 py-2.5 text-neutral-600">{row.label}</td>
                        {plans.map((p) => {
                          const v = p.features?.[row.key];
                          return (
                            <td key={p.id} className="px-4 py-2.5">
                              {row.kind === 'limit'
                                ? typeof v === 'number'
                                  ? String(v)
                                  : p.features?.thread === true
                                    ? 'Unlimited'
                                    : '—'
                                : v === true
                                  ? '✓'
                                  : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-12 max-w-2xl space-y-4 text-sm text-neutral-600 leading-relaxed">
            <p>
              <strong className="font-medium text-neutral-900">Above the bundle:</strong> €1 per
              1,000 emails · €0.50 per GB per month · extra seats as listed. We warn you well before
              a limit matters, and we never refuse to send a ticket — a message that does not arrive
              is a failure, not a billing event.
            </p>
            <p>
              <strong className="font-medium text-neutral-900">Downgrading never deletes
              anything.</strong> What a smaller plan lacks becomes read-only, not gone, and the way
              back is a click. Live events keep working regardless of plan state — payment problems
              are settled with the organiser, never at the door.
            </p>
            <p>
              <strong className="font-medium text-neutral-900">Free is permanent.</strong> A
              community group running one gathering a year should never pay for the privilege. The
              small fee on paid enrolments means it still covers its own postage.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function CompareRow({
  label,
  plans,
  value,
}: {
  label: string;
  plans: CataloguePlan[];
  value: (p: CataloguePlan) => string;
}) {
  return (
    <tr className="border-b border-neutral-100">
      <td className="px-4 py-2.5 text-neutral-600">{label}</td>
      {plans.map((p) => (
        <td key={p.id} className="px-4 py-2.5">
          {value(p)}
        </td>
      ))}
    </tr>
  );
}
