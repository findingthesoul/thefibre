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
import { fmtDate } from '@/lib/format';
import { SignedOut } from '../signed-out';
import { PageShell, Empty } from '../page-shell';
import { JoinPrice } from '../join-price';
import { JoinButton } from './join-button';

export const dynamic = 'force-dynamic';

export default async function UpcomingPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const session = await loadFrame();
  if (!session) return <SignedOut />;
  const { cursor = null } = await searchParams;

  let page: UpcomingPage | null = null;
  try {
    page = await fetchUpcoming(session.token, cursor);
  } catch (e) {
    console.error('[my] /me/portal/upcoming failed', e);
  }

  return (
    <PageShell title="Upcoming" subtitle="What your membership lets you join, at your price.">
      {!page ? (
        // A broken call says so. "Nothing coming up" here would be a claim
        // about the calendar that nobody checked.
        <Empty title="This list could not be loaded.">
          Try again in a moment. Your memberships and what you joined are unaffected.
        </Empty>
      ) : !page.entitled ? (
        <Empty title="None of your memberships includes a team calendar.">
          When one does, everything on that calendar appears here, at the price your membership
          makes it.
        </Empty>
      ) : page.items.length === 0 ? (
        <Empty title={cursor ? 'That is everything.' : 'Nothing coming up right now.'}>
          {cursor
            ? 'There is nothing further on your calendars.'
            : 'New threads on your team calendars appear here as soon as they are published. Anything you already joined is under Next.'}
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
                  {j.starts_on ? `${fmtDate(j.starts_on)} · ` : ''}
                  {j.team} · <JoinPrice j={j} />
                </p>
                {j.payment === 'unavailable' ? (
                  // Paid, and the organiser has no way to take the money yet.
                  // Never a button into that dead end, and never a link to a
                  // page that has the same dead end on it.
                  <p className="mt-1 text-sm text-ink-muted">Sign-up not open yet.</p>
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
                    Sign up on its page
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
              More
            </Link>
          )}
        </>
      )}
    </PageShell>
  );
}
