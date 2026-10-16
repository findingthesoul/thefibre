// UPCOMING — everything the member's team calendars let them join.
//
// The full list behind the Memberships card's six, from the same walk
// (apps/api/src/lib/could-join.ts), so a price here and a price on the card
// can never disagree. Published threads in the member's teams, programme
// active, sign-ups open, still running — and NOT only the publicly listed
// ones. Sjoerd, 2026-10-14: "As it is published they can see it. Even if the
// button Public is switched off."
//
// Shown in the nav only to somebody whose membership carries a team calendar;
// the page still answers anyone who types the address, in a sentence.

import Link from 'next/link';
import { ROW_LIST } from '@thefibre/shared/ui/recipes';
import { loadFrame } from '@/lib/session';
import { fetchUpcoming, type UpcomingPage } from '@/lib/portal-api';
import { threadDateLine } from '@thefibre/shared/thread-date-line';
import { toCardDates } from '@thefibre/shared/thread-dates';
import { SignedOut } from '../signed-out';
import { PageShell, Empty } from '../page-shell';
import { JoinPrice } from '../join-price';
import { JoinButton } from './join-button';
import { pageLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function UpcomingPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const session = await loadFrame();
  if (!session) return <SignedOut />;
  const { cursor = null } = await searchParams;
  const locale = await pageLocale();

  let page: UpcomingPage | null = null;
  try {
    page = await fetchUpcoming(session.token, cursor);
  } catch (e) {
    console.error('[my] /me/portal/upcoming failed', e);
  }

  return (
    <PageShell title={t(locale, 'nav_upcoming')} subtitle={t(locale, 'upcoming_subtitle')}>
      {!page ? (
        // A broken call says so. "Nothing coming up" here would be a claim
        // about the calendar that nobody checked.
        <Empty title={t(locale, 'list_failed')}>{t(locale, 'upcoming_failed_body')}</Empty>
      ) : !page.entitled ? (
        <Empty title={t(locale, 'upcoming_none_title')}>{t(locale, 'upcoming_none_body')}</Empty>
      ) : page.items.length === 0 ? (
        <Empty title={cursor ? t(locale, 'upcoming_end_title') : t(locale, 'upcoming_empty_title')}>
          {cursor ? t(locale, 'upcoming_end_body') : t(locale, 'upcoming_empty_body')}
        </Empty>
      ) : (
        <>
          <ul className={`mt-8 ${ROW_LIST}`}>
            {page.items.map((j) => (
              <li key={j.thread_id} className="px-4 py-4 sm:px-5">
                <a
                  href={j.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-base text-ink underline-offset-2 hover:underline"
                >
                  {j.title}
                </a>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {(() => {
                    // A card from a community's calendar: that community's
                    // card choice, through the shared rule (thread dates
                    // slice 4). It printed the start date alone until then.
                    const line = threadDateLine(
                      { ...j, ends_on: j.ends_on ?? null },
                      toCardDates(j.workspace_id ? page.card_dates?.[j.workspace_id] : null),
                      { language: locale, timezone: j.timezone },
                    );
                    return line ? `${line} · ` : '';
                  })()}
                  {j.team} · <JoinPrice j={j} locale={locale} />
                </p>
                {j.payment === 'unavailable' ? (
                  // Paid, and the organiser has no way to take the money yet.
                  // Never a button into that dead end, and never a link to a
                  // page that has the same dead end on it.
                  <p className="mt-1 text-sm text-ink-muted">{t(locale, 'signup_not_open')}</p>
                ) : j.direct && j.owner_slug && j.thread_slug ? (
                  <JoinButton j={j} />
                ) : (
                  // A required question, an invoice (billing details), or an
                  // API too old to say: the thread's own page handles it.
                  <a
                    href={j.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-2 hover:opacity-70"
                  >
                    {t(locale, 'signup_on_page')}
                  </a>
                )}
              </li>
            ))}
          </ul>
          {page.next_cursor && (
            <Link
              href={`/upcoming?cursor=${encodeURIComponent(page.next_cursor)}`}
              className="mt-4 inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-2 hover:opacity-70"
            >
              {t(locale, 'more')}
            </Link>
          )}
        </>
      )}
    </PageShell>
  );
}
