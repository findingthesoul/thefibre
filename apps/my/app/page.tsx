// The visitor's own place. Everything you are part of, grouped by the
// organiser you know — which is the workspace (Sjoerd, 2026-09-08).
//
// One API call. No Supabase reads here beyond the session itself: the whole
// security model is server-side in routes/portal.ts, where the verified
// email is the only thing scoping the query.

import { SURFACES, ENTITY } from '@thefibre/shared';
import { serverSupabase } from '@/lib/supabase/server';
import {
  fetchInvoices,
  fetchPortal,
  invoicePdfUrl,
  PortalApiError,
  type Group,
  type Portal,
  type PortalInvoice,
} from '@/lib/portal-api';
import { SignIn } from './sign-in';
import { Ticket } from './ticket';
import { ThreadDetail } from './detail';

export const dynamic = 'force-dynamic';

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(cents / 100);
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-16">{children}</main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="text-xs font-medium uppercase tracking-wide text-ink-muted">{title}</h3>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

function GroupCard({
  group,
  wallet,
  invoices,
}: {
  group: Group;
  wallet: Portal['wallet'];
  /** member_id → that membership's invoices. Empty when there are none, or
   *  when the fetch failed for that one membership. */
  invoices: Map<string, PortalInvoice[]>;
}) {
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
                  className="mt-1 inline-block text-sm text-ink underline underline-offset-2 hover:opacity-70"
                >
                  Join
                </a>
              )}
            </div>
          ))}
        </Section>
      )}

      {group.memberships.length > 0 && (
        <Section title="Membership">
          {group.memberships.map((m) => {
            const rows = invoices.get(m.member_id) ?? [];
            return (
              <div
                key={m.member_id}
                className="rounded-xl border border-line bg-surface-raised p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-ink">{m.tier ?? 'Member'}</span>
                  <span className="text-sm text-ink-muted">
                    {m.status === 'active' && m.renews_at
                      ? `Renews ${fmtDate(m.renews_at)}`
                      : m.status}
                  </span>
                </div>

                {/* Invoices. Sjoerd, 2026-09-09: "add invoices" — and before
                    that, "can't find them now", which was correct: they were
                    never on this surface. The empty state says so out loud
                    rather than showing nothing, because an empty list and a
                    missing feature look identical otherwise. */}
                <div className="mt-3 border-t border-line pt-3">
                  <h4 className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Invoices
                  </h4>
                  {rows.length === 0 ? (
                    <p className="mt-1 text-sm text-ink-muted">
                      Nothing invoiced yet.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {rows.map((inv) => (
                        <li
                          key={inv.id}
                          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm"
                        >
                          <span className="min-w-0 truncate text-ink">
                            {inv.item_label ?? 'Membership'}
                          </span>
                          <span className="flex items-center gap-3">
                            <span className="tabular-nums text-ink">
                              {money(inv.amount_cents, inv.currency)}
                            </span>
                            <span className="text-xs text-ink-muted">
                              {fmtDate(inv.created_at)}
                            </span>
                            {inv.status !== 'paid' && (
                              <span className="text-xs text-ink-muted">{inv.status}</span>
                            )}
                            <a
                              href={invoicePdfUrl(inv.id)}
                              className="inline-flex min-h-11 items-center text-ink underline underline-offset-2 hover:opacity-70"
                            >
                              PDF
                            </a>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </Section>
      )}
    </article>
  );
}

export default async function Page() {
  const supabase = await serverSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return (
      <Shell>
        <h1 className="text-2xl font-medium tracking-tight text-ink">
          {SURFACES['my-portal'].shortLabel}
        </h1>
        <p className="mt-1 text-ink-subtle">{SURFACES['my-portal'].tagline}</p>
        <div className="mt-8 max-w-sm">
          <SignIn />
        </div>
        <p className="mt-10 text-xs text-ink-muted">{ENTITY.publicName}</p>
      </Shell>
    );
  }

  let portal;
  try {
    portal = await fetchPortal(session.access_token);
  } catch (e) {
    if (e instanceof PortalApiError && e.status === 401) {
      return (
        <Shell>
          <h1 className="text-2xl font-medium tracking-tight text-ink">
            {SURFACES['my-portal'].shortLabel}
          </h1>
          <div className="mt-8 max-w-sm">
            <SignIn />
          </div>
        </Shell>
      );
    }
    throw e;
  }

  const name = portal.person.first_name;

  // One call per membership, in parallel, server-side with the same token.
  // Per membership because that is the endpoint's shape (Membership's own /my
  // does the same). A failure yields an empty list for THAT membership rather
  // than failing the page: three memberships and one bad workspace should
  // still show the other two.
  const memberIds = portal.groups.flatMap((g) => g.memberships.map((m) => m.member_id));
  const invoiceLists = await Promise.all(
    memberIds.map((id) => fetchInvoices(session.access_token, id)),
  );
  const invoicesByMember = new Map(memberIds.map((id, i) => [id, invoiceLists[i] ?? []]));

  return (
    <Shell>
      <header>
        <h1 className="text-2xl font-medium tracking-tight text-ink">
          {name ? `Hello, ${name}` : SURFACES['my-portal'].shortLabel}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">{portal.person.email}</p>
      </header>

      {portal.groups.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-line bg-surface-sunken p-6">
          <p className="text-ink">Nothing here yet.</p>
          <p className="mt-1 text-sm text-ink-muted">
            When you book a place, a call or a membership, it appears here — grouped by
            who&rsquo;s organising it. If you expected something, check you signed in with the
            address you booked with.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          {portal.groups.map((g) => (
            <GroupCard
              key={g.workspace_id}
              group={g}
              wallet={portal.wallet}
              invoices={invoicesByMember}
            />
          ))}
        </div>
      )}

      <p className="mt-12 text-xs text-ink-muted">{ENTITY.publicName}</p>
    </Shell>
  );
}
