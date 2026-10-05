// The member list — the first surface where one member sees another.
//
// Sjoerd asked for this in one sentence: "Members need to see each other.
// Can we create a list of members. With profiles. Ways to contact them."
// Everything before it existed so that this page could be built without
// anyone having to decide, here, who may see whom.
//
// FOUR STATES, kept apart on purpose. This community has no directory; we
// could not find out; the directory exists and you are not in it; the
// directory exists and here are the people. Rendering any two of those the
// same is the empty that reads as working — the mistake this repo keeps
// catching, including in my own code on 2026-10-05, when a failed load
// silently omitted a privacy switch and looked like a page with nothing on
// it.

import Link from 'next/link';
import { ArrowLeft, Mail, Phone, Globe, Linkedin } from 'lucide-react';
import { loadDirectoryChoices, loadDirectoryMembers, loadSession } from '@/lib/session';
import { SignedOut } from '../../signed-out';
import { PageShell } from '../../page-shell';

export default async function MembersPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const session = await loadSession();
  if (!session) return <SignedOut />;

  const [list, choices] = await Promise.all([
    loadDirectoryMembers(workspaceId),
    loadDirectoryChoices(),
  ]);
  // null = the choices call failed; the heading just falls back to "Members"
  // rather than naming a community we could not confirm.
  const community = (choices ?? []).find((c) => c.workspace_id === workspaceId);
  const title = community ? `Members of ${community.workspace_name}` : 'Members';

  return (
    <PageShell title={title}>
      <Link
        href="/you"
        className="mt-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft size={15} strokeWidth={1.75} />
        Back to you
      </Link>

      {list.state === 'failed' && (
        <p className="mt-6 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-subtle">
          We couldn&apos;t load this right now. Nothing has changed, and nobody has been shown
          anything — try again in a moment.
        </p>
      )}

      {list.state === 'none' && (
        <p className="mt-6 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-subtle">
          This community doesn&apos;t have a member list.
        </p>
      )}

      {list.state === 'ok' && !list.you_are_listed && (
        // Being in a directory and reading one are the same bargain. Said
        // plainly, with the way to change it, rather than showing an empty
        // page that looks broken.
        <div className="mt-6 rounded-2xl border border-line bg-surface px-4 py-3">
          <p className="text-sm text-ink">You&apos;re not in this member list yet.</p>
          <p className="mt-1 text-xs text-ink-muted">
            The list shows members to each other, so you see it once you appear in it. You can turn
            that on, and off again, on your{' '}
            <Link href="/you" className="underline hover:text-ink">
              You
            </Link>{' '}
            page.
          </p>
        </div>
      )}

      {list.state === 'ok' && list.you_are_listed && list.items.length === 0 && (
        <p className="mt-6 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-subtle">
          You&apos;re the only one here so far. Nobody else has chosen to appear yet.
        </p>
      )}

      {list.state === 'ok' && list.items.length > 0 && (
        <ul className="mt-6 space-y-3">
          {list.items.map((m) => (
            <li key={m.person_id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-start gap-3">
                {m.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.photo_url}
                    alt={m.display_name}
                    className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-line"
                  />
                ) : (
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-sm font-medium text-ink-subtle ring-1 ring-line">
                    {m.display_name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{m.display_name}</p>
                  {(m.city || m.country) && (
                    <p className="text-xs text-ink-muted">
                      {[m.city, m.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {m.bio && (
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-subtle">{m.bio}</p>
                  )}

                  {(m.tags.length > 0 || m.categories.length > 0) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.categories.map((c) => (
                        <span
                          key={`c-${c}`}
                          className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] text-ink-subtle"
                        >
                          {c}
                        </span>
                      ))}
                      {m.tags.map((tg) => (
                        <span
                          key={`t-${tg}`}
                          className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-muted"
                        >
                          {tg}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Only what this member chose to show. The server decides
                      — these are null unless show(M) resolved true. */}
                  {(m.email || m.phone || m.linkedin_url || m.website_url) && (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      {m.email && (
                        <a
                          href={`mailto:${m.email}`}
                          className="inline-flex items-center gap-1 text-ink-muted hover:text-ink"
                        >
                          <Mail size={13} strokeWidth={1.75} />
                          {m.email}
                        </a>
                      )}
                      {m.phone && (
                        <a
                          href={`tel:${m.phone}`}
                          className="inline-flex items-center gap-1 text-ink-muted hover:text-ink"
                        >
                          <Phone size={13} strokeWidth={1.75} />
                          {m.phone}
                        </a>
                      )}
                      {m.linkedin_url && (
                        <a
                          href={m.linkedin_url}
                          rel="noreferrer noopener"
                          target="_blank"
                          className="inline-flex items-center gap-1 text-ink-muted hover:text-ink"
                        >
                          <Linkedin size={13} strokeWidth={1.75} />
                          LinkedIn
                        </a>
                      )}
                      {m.website_url && (
                        <a
                          href={m.website_url}
                          rel="noreferrer noopener"
                          target="_blank"
                          className="inline-flex items-center gap-1 text-ink-muted hover:text-ink"
                        >
                          <Globe size={13} strokeWidth={1.75} />
                          Website
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
