// MEMBERSHIPS — what you belong to, what it gets you, and what it costs.
//
// A membership has no date, it has a state, so putting it in a chronological
// list means inventing a position for it (docs/member-portal-plan.md §3).
// It gets its own tab instead.
//
// Slice 4 filled it in. Sjoerd: "click and then what it contains, with links
// to what is included and invoices". Two sources feed "includes" and both
// are the member's by different routes — the non-optional products of their
// tier, held for as long as they are a member, and the products they bought
// outright, kept through a tier change or a lapse. The API resolves both,
// and resolves a thread link to a real address rather than showing a ref.

import Link from 'next/link';
import { loadSession } from '@/lib/session';
import { DEFAULT_TZ, fmtDate } from '@/lib/format';
import { JoinPrice } from '../join-price';
import { GoogleCard } from './google-card';
import { SignedOut } from '../signed-out';
import { PageShell, Empty } from '../page-shell';
import { pageLocale } from '@/lib/locale';
import { t, type MyKey } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

const STATE: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  grace: 'bg-amber-50 text-amber-700 ring-amber-200',
  lapsed: 'bg-surface-sunken text-ink-muted ring-line',
  cancelled: 'bg-surface-sunken text-ink-muted ring-line',
};

/** Said in words, because a member should not have to know our vocabulary. */
const STATE_NOTE: Record<string, MyKey> = {
  grace: 'note_grace',
  lapsed: 'note_lapsed',
  cancelled: 'note_cancelled',
};
// The badge's word. A status the API adds later shows as the API sent it.
const STATE_WORD: Record<string, MyKey> = {
  active: 'state_active',
  grace: 'state_grace',
  lapsed: 'state_lapsed',
  cancelled: 'state_cancelled',
};

export default async function MembershipsPage() {
  const session = await loadSession();
  if (!session) return <SignedOut />;
  const locale = await pageLocale();

  const items = session.portal.groups.flatMap((g) =>
    g.memberships.map((m) => ({ ...m, workspace: g.name })),
  );

  // YOUR PRODUCTS, AND NOT ONLY A MEMBER'S.
  //
  // Somebody can buy a product from a community without ever joining it — and
  // until 2026-10-14 this page told them "You are not a member anywhere yet."
  // and showed nothing else, which was both true and useless: they had paid
  // for something and there was no sign of it. The API lists purchases by
  // PERSON now, so this reads them off the group rather than off a
  // membership, and a community the person only ever bought from still has a
  // group to put them in.
  //
  // That matters more now that the Members app's own `/my` redirects here:
  // this page is the only place left for a product-only buyer to land.
  const byWorkspace = session.portal.groups
    .map((g) => ({ name: g.name, products: g.products ?? [] }))
    .filter((g) => g.products.length > 0);
  const nothingAtAll = items.length === 0 && byWorkspace.length === 0;

  return (
    <PageShell title={t(locale, 'nav_memberships')}>
      {nothingAtAll ? (
        <Empty title={t(locale, 'memberships_none_title')}>{t(locale, 'memberships_none_body')}</Empty>
      ) : (
        <ul className="mt-8 space-y-3">
          {items.map((m) => {
            const includes = m.includes ?? [];
            return (
              <li key={m.member_id} className="rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-base font-medium text-ink">{m.workspace}</div>
                    <div className="mt-0.5 text-sm text-ink-subtle">{m.tier ?? t(locale, 'member')}</div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] capitalize ring-1 ${
                      STATE[m.status] ?? STATE.lapsed
                    }`}
                  >
                    {STATE_WORD[m.status] ? t(locale, STATE_WORD[m.status]!) : m.status}
                  </span>
                </div>

                {STATE_NOTE[m.status] && (
                  <p className="mt-2 text-sm text-ink-subtle">{t(locale, STATE_NOTE[m.status]!)}</p>
                )}
                {m.status === 'active' && m.renews_at && (
                  <p className="mt-2 text-xs text-ink-muted">{t(locale, 'renews_date', { date: fmtDate(m.renews_at, locale, DEFAULT_TZ) ?? '' })}</p>
                )}
                {m.started_at && (
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {t(locale, 'member_since', { date: fmtDate(m.started_at, locale, DEFAULT_TZ) ?? '' })}
                  </p>
                )}

                {/* What it gets you. An empty list is a real answer — a tier
                    can include nothing but belonging — so it says that
                    rather than showing an empty heading. */}
                <div className="mt-4 border-t border-line pt-4">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    {t(locale, 'what_includes')}
                  </h3>
                  {includes.length === 0 ? (
                    <p className="mt-1 text-sm text-ink-muted">
                      {t(locale, 'belonging_only', { community: m.workspace })}
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {includes.map((inc, i) => (
                        <li key={i} className="text-sm">
                          {inc.url ? (
                            <a
                              href={inc.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex min-h-11 items-center text-ink underline underline-offset-2 hover:opacity-70"
                            >
                              {inc.name}
                            </a>
                          ) : (
                            <span className="text-ink">{inc.name}</span>
                          )}
                          {inc.description && (
                            <p className="text-ink-muted">{inc.description}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* WHAT IT LETS YOU JOIN. The other half of "what this
                    includes": that one lists what you already hold, this
                    lists what you could take up next, at the price this
                    membership makes it. Absent when there is nothing — a
                    heading over an empty list tells a member their
                    membership gets them nothing, which is a different
                    claim. */}
                {(m.could_join ?? []).length > 0 && (
                  <div className="mt-4 border-t border-line pt-4">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                      {t(locale, 'what_join')}
                    </h3>
                    <ul className="mt-2 space-y-2">
                      {(m.could_join ?? []).map((j) => (
                        <li key={j.thread_id} className="text-sm">
                          <a
                            href={j.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-11 items-center text-ink underline underline-offset-2 hover:opacity-70"
                          >
                            {j.title}
                          </a>
                          <p className="text-ink-muted">
                            {j.starts_on ? `${fmtDate(j.starts_on, locale, j.timezone || DEFAULT_TZ)} · ` : ''}
                            {j.team} ·{' '}
                            {j.payment === 'unavailable' ? (
                              <span>{t(locale, 'signup_not_open_lc')}</span>
                            ) : (
                              <JoinPrice j={j} locale={locale} />
                            )}
                          </p>
                        </li>
                      ))}
                    </ul>
                    {session.portal.upcoming && (
                      <Link
                        href="/upcoming"
                        className="mt-1 inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-2 hover:opacity-70"
                      >
                        {t(locale, 'everything_coming')}
                      </Link>
                    )}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-x-4">
                  <Link
                    href="/purchases"
                    className="inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-2 hover:opacity-70"
                  >
                    {t(locale, 'what_you_paid')}
                  </Link>
                  {/* Managed HERE, never on Stripe (Sjoerd, 2026-10-16, the
                      fourth time of asking): the card, stopping the renewal
                      and adding to it all live under Purchases. The old
                      "Manage payment" button opened Stripe's portal; gone. */}
                  {m.has_stripe && (
                    <Link
                      href="/purchases"
                      className="inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-2 hover:opacity-70"
                    >
                      {t(locale, 'card_renewal_addons')}
                    </Link>
                  )}
                </div>
                {/* The Google address this membership includes, if any —
                    renders nothing otherwise (google-card.tsx). */}
                {(m.status === 'active' || m.status === 'grace') && <GoogleCard memberId={m.member_id} />}
              </li>
            );
          })}
        </ul>
      )}

      {/* YOUR PRODUCTS — its own section, below the memberships, because a
          product is not a membership and does not belong inside one. It
          appears for a member who bought something à la carte AND for
          somebody who bought from a community they never joined, which is the
          case that used to see an empty page.

          Each one carries the day it was bought: "when did I buy this" is the
          question a person actually asks of a list like this, and a list of
          names cannot answer it. */}
      {byWorkspace.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            {t(locale, 'your_products')}
          </h2>
          <ul className="mt-3 space-y-3">
            {byWorkspace.map((g) => (
              <li key={g.name} className="rounded-2xl border border-line bg-surface p-5">
                <div className="truncate text-base font-medium text-ink">{g.name}</div>
                <ul className="mt-3 space-y-2">
                  {g.products.map((pr, i) => (
                    <li key={i} className="text-sm">
                      {pr.url ? (
                        <a
                          href={pr.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-11 items-center text-ink underline underline-offset-2 hover:opacity-70"
                        >
                          {pr.name}
                        </a>
                      ) : (
                        <span className="text-ink">{pr.name}</span>
                      )}
                      <p className="text-ink-muted">{t(locale, 'bought_on', { date: fmtDate(pr.bought_on, locale, DEFAULT_TZ) ?? '' })}</p>
                      {pr.description && <p className="text-ink-muted">{pr.description}</p>}
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  <Link
                    href="/purchases"
                    className="inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-2 hover:opacity-70"
                  >
                    {t(locale, 'what_you_paid')}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageShell>
  );
}
