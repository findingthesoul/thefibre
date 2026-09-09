// NEXT — everything with a date, still grouped by the organiser you know.
//
// Slice 1 of docs/member-portal-plan.md moves the existing content into the
// four-destination shell WITHOUT changing it: memberships and invoices left
// for their own tabs, tickets, threads and meets stayed. Slice 2 turns this
// into one flat date-ordered timeline, which is the shape the plan argues
// for and this is not yet.

import { loadSession } from '@/lib/session';
import { fmtDateTime } from '@/lib/format';
import type { Group, Portal } from '@/lib/portal-api';
import { SignedOut } from './signed-out';
import { PageShell, Empty } from './page-shell';
import { Ticket } from './ticket';
import { ThreadDetail } from './detail';

export const dynamic = 'force-dynamic';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="text-xs font-medium uppercase tracking-wide text-ink-muted">{title}</h3>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

function GroupCard({ group, wallet }: { group: Group; wallet: Portal['wallet'] }) {
  // A ticket belongs to a thread. Showing both separately made the same
  // event appear twice, so the ticket rides inside its thread's detail and
  // only an ORPHAN ticket — one whose thread isn't in this payload — still
  // gets its own row.
  const ticketFor = new Map(group.tickets.map((t) => [t.thread_id, t]));
  const threadIds = new Set(group.threads.map((t) => t.thread_id));
  const orphanTickets = group.tickets.filter((t) => !threadIds.has(t.thread_id));

  return (
    <article className="rounded-2xl border border-line bg-surface p-5">
      <header className="flex items-center gap-3">
        {group.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={group.logo_url} alt="" className="h-9 w-9 rounded-lg object-contain" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-sunken text-sm font-medium text-ink-muted">
            {group.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <h2 className="text-lg font-medium tracking-tight text-ink">{group.name}</h2>
      </header>

      {orphanTickets.length > 0 && (
        <Section title="Tickets">
          {orphanTickets.map((t) => (
            <Ticket key={t.enrolment_id} ticket={t} />
          ))}
        </Section>
      )}

      {group.threads.length > 0 && (
        <Section title="Threads">
          {group.threads.map((t) => (
            <ThreadDetail
              key={t.thread_id}
              thread={t}
              ticket={ticketFor.get(t.thread_id) ?? null}
              wallet={wallet}
            />
          ))}
        </Section>
      )}

      {group.meets.length > 0 && (
        <Section title="Meetings">
          {group.meets.map((m) => (
            <div key={m.booking_id} className="rounded-xl border border-line bg-surface-raised p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="font-medium text-ink">{m.title}</h4>
                <span className="shrink-0 text-xs text-ink-muted">{fmtDateTime(m.starts_at)}</span>
              </div>
              {m.host && <p className="mt-0.5 text-sm text-ink-muted">with {m.host}</p>}
              {m.location && <p className="text-sm text-ink-muted">{m.location}</p>}
              {m.meet_url && (
                <a
                  href={m.meet_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-2 hover:opacity-70"
                >
                  Join
                </a>
              )}
            </div>
          ))}
        </Section>
      )}
    </article>
  );
}

export default async function NextPage() {
  const session = await loadSession();
  if (!session) return <SignedOut />;

  const { portal } = session;
  const name = portal.person.first_name;
  // A community with only a membership in it belongs on the Memberships tab,
  // not here: this tab is things with a date.
  const dated = portal.groups.filter(
    (g) => g.tickets.length + g.threads.length + g.meets.length > 0,
  );

  return (
    <PageShell title={name ? `Hello, ${name}` : 'Next'} subtitle={portal.person.email}>
      {dated.length === 0 ? (
        <Empty title="Nothing coming up.">
          When you book a place or a call, it appears here — soonest first. If you expected
          something, check you signed in with the address you booked with.
        </Empty>
      ) : (
        <div className="mt-8 space-y-5">
          {dated.map((g) => (
            <GroupCard key={g.workspace_id} group={g} wallet={portal.wallet} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
