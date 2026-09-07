// The public listing page body, shared between its two addresses
// (docs/brief-workspace-urls.md):
//
//   /{owner}              organiser · team · workspace listing
//   /{workspace}/{organiser}   the organiser INSIDE the workspace
//
// Presentational server component — both routes fetch and hand the payload
// here so the render never forks.

import Link from 'next/link';
import { ThreadsGrid, type PublicThreadListItem } from './threads-grid';

export type PublicOrganiser = {
  id?: string;
  slug: string;
  display_name: string | null;
  bio?: string | null;
  photo_url?: string | null;
};

export function OrganiserListing({
  organiser,
  threads,
  baseSlug,
  workspace = null,
}: {
  organiser: PublicOrganiser;
  threads: PublicThreadListItem[];
  /** The owner slug thread links (and the enrol popup) live under —
   *  the workspace's for a workspace listing, else the organiser's. */
  baseSlug: string;
  /** Set on the /{workspace}/{organiser} form: names the workspace the
   *  organiser is listed within and links back to its page. */
  workspace?: { slug: string; name: string | null } | null;
}) {
  const name = organiser.display_name ?? organiser.slug;

  return (
    <div className="min-h-screen bg-surface-sunken">
      <main className="mx-auto max-w-2xl px-6 py-16">
        {workspace && (
          <nav className="mb-8 text-sm">
            <Link href={`/${workspace.slug}`} className="text-ink-subtle hover:text-ink">
              ← {workspace.name ?? workspace.slug}
            </Link>
          </nav>
        )}
        <header className="flex items-center gap-4">
          {organiser.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={organiser.photo_url}
              alt={name}
              className="h-16 w-16 rounded-full object-cover ring-1 ring-line"
            />
          ) : (
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-surface-raised ring-1 ring-line text-xl font-medium text-ink-subtle">
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <h1 className="text-2xl font-medium tracking-tight">
              {name}
              {workspace && (
                <span className="text-ink-muted"> · {workspace.name ?? workspace.slug}</span>
              )}
            </h1>
            {organiser.bio && (
              <p className="mt-1 text-sm text-ink-subtle leading-relaxed">{organiser.bio}</p>
            )}
          </div>
        </header>

        <section className="mt-12">
          <h2 className="text-[11px] uppercase tracking-wider text-ink-muted">Threads</h2>
          {threads.length === 0 && (
            <p className="mt-3 text-sm text-ink-subtle">Nothing public right now.</p>
          )}
          <ThreadsGrid organiserSlug={baseSlug} threads={threads} />
        </section>

        <footer className="mt-16 text-xs text-ink-muted">
          Powered by <span className="font-medium">Thread</span> · The Fibre
        </footer>
      </main>
    </div>
  );
}
