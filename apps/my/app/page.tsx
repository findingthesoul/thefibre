// NEXT — one list, ordered by date, soonest first.
//
// Slice 2 of docs/member-portal-plan.md. The organiser used to be the page's
// skeleton and the dates were scattered inside it; time is the spine now and
// the organiser is a filter. "What is next" is a chronological question.

import { loadSession } from '@/lib/session';
import { buildTimeline, splitAt } from '@/lib/timeline';
import type { Ticket as TicketRow, ThreadItem } from '@/lib/portal-api';
import { SignedOut } from './signed-out';
import { PageShell, Empty } from './page-shell';
import { Ticket } from './ticket';
import { Timeline } from './timeline';

export const dynamic = 'force-dynamic';

export default async function NextPage() {
  const session = await loadSession();
  if (!session) return <SignedOut />;

  const { portal } = session;
  const { upcoming, past } = splitAt(buildTimeline(portal));

  // Every thread a card can open, flat, with the ticket that belongs to it.
  const threads: Record<string, { thread: ThreadItem; ticket: TicketRow | null }> = {};
  // A ticket whose thread is NOT in the payload has no card to ride inside,
  // so it keeps its own row above the list. Rare, and the one case where a
  // QR would otherwise be unreachable.
  const orphans: TicketRow[] = [];
  for (const g of portal.groups) {
    const ticketFor = new Map(g.tickets.map((t) => [t.thread_id, t]));
    for (const t of g.threads) {
      threads[t.thread_id] = { thread: t, ticket: ticketFor.get(t.thread_id) ?? null };
    }
    const known = new Set(g.threads.map((t) => t.thread_id));
    orphans.push(...g.tickets.filter((t) => !known.has(t.thread_id)));
  }

  const name = portal.person.first_name;
  const nothing = upcoming.length === 0 && past.length === 0 && orphans.length === 0;

  return (
    <PageShell title={name ? `Hello, ${name}` : 'Next'} subtitle={portal.person.email}>
      {nothing ? (
        <Empty title="Nothing coming up.">
          When you book a place or a call, it appears here — soonest first. If you expected
          something, check you signed in with the address you booked with.
        </Empty>
      ) : (
        <>
          {orphans.length > 0 && (
            <ul className="mt-6 space-y-2">
              {orphans.map((t) => (
                <li key={t.enrolment_id}>
                  <Ticket ticket={t} />
                </li>
              ))}
            </ul>
          )}
          <Timeline
            entries={upcoming}
            past={past}
            threads={threads}
            wallet={portal.wallet}
          />
        </>
      )}
    </PageShell>
  );
}
