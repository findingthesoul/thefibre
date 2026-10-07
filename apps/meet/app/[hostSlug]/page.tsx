import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { APPS, ENTITY, surfaceUrl } from '@thefibre/shared';
import { publicFetch, PublicApiError } from '@/lib/public-api';
import { bioToHtml, fullBioAddsMore } from '@thefibre/shared';
import { RichText } from '@thefibre/shared/ui/rich-text';
import { publicT, toLocale, type Locale } from '@/lib/i18n-public';
import { WorkspaceLine, type PublicWorkspace } from './workspace-line';

type MeetingType = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  conferencing_provider: string;
  default_location: string | null;
  price_cents: number | null;
  price_currency: string | null;
};

type Host = {
  /** Resolved by the API through resolvePublicLocale — the page never runs
   *  the chain itself. */
  locale?: string | null;
  id: string;
  slug: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  /** Resolved by the API (resolveShortBio): the host's own short bio, else
   *  the opening of `bio`. Optional because an API that predates it omits it. */
  short_bio?: string | null;
  photo_url: string | null;
  location: string | null;
  timezone: string;
  workspace?: PublicWorkspace | null;
  meeting_types: MeetingType[];
};

type Team = {
  locale?: string | null;
  id: string;
  slug: string;
  name: string;
  description: string | null;
  workspace?: PublicWorkspace | null;
  meeting_types: MeetingType[];
};

// Renders either a host page or a team page depending on what the root slug
// resolves to. We try host first (existing route), fall back to team.
export default async function RootSlugPage({
  params,
}: {
  params: Promise<{ hostSlug: string }>;
}) {
  const { hostSlug: slug } = await params;
  // Try host.
  let host: Host | null = null;
  try {
    host = await publicFetch<Host>(`/api/v1/meet/public/host/${encodeURIComponent(slug)}`);
  } catch (e) {
    if (!(e instanceof PublicApiError) || e.status !== 404) throw e;
  }
  if (host) return <HostView host={host} L={toLocale(host.locale)} />;

  // Fall back to team.
  let team: Team | null = null;
  try {
    team = await publicFetch<Team>(`/api/v1/meet/public/team/${encodeURIComponent(slug)}`);
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) notFound();
    throw e;
  }
  if (!team) notFound();
  return <TeamView team={team} L={toLocale(team.locale)} />;
}

function HostView({ host, L }: { host: Host; L: Locale }) {
  const photo = host.photo_url ?? host.avatar_url;
  const name = host.full_name ?? host.slug;
  const bioHtml = bioToHtml(host.bio);
  const shortBio = host.short_bio ?? null;
  // A booking page is a compact spot (Sjoerd, 2026-10-07): the short bio is
  // what a guest reads, beside the meeting types they came for. The full bio
  // stays one click away rather than pushing the list below the fold — and
  // is shown open, as before, when there is no short bio to stand in for it
  // (an API that predates the field).
  const moreToRead = shortBio ? fullBioAddsMore(shortBio, host.bio) : false;
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <WorkspaceLine workspace={host.workspace} className="mb-6" />
        <header className="flex items-center gap-5">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt={name}
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400">
              {(host.full_name ?? host.slug).slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-medium tracking-tight">
              {host.full_name ?? host.slug}
            </h1>
            {host.location && (
              <div className="text-sm text-neutral-500 mt-1">{host.location}</div>
            )}
          </div>
        </header>

        {/* neutral-*, not the ink tokens, like everything else on this page:
            the page paints its own white ground, and a token would follow
            the visitor's dark theme onto it (light text on white). */}
        {shortBio && (
          <p className="mt-6 text-neutral-700 leading-relaxed">{shortBio}</p>
        )}

        {/* The bio is becoming rich text. Until every stored bio has been
            converted it may still be plain, so it goes through bioToHtml,
            which escapes-and-wraps plain text and passes HTML through — see
            packages/shared/src/bio-html.ts, which is scaffolding with a
            demolition date. The output of the plain branch renders exactly as
            the whitespace-pre-wrap above it did. */}
        {bioHtml && !shortBio && (
          <RichText
            html={bioHtml}
            className="mt-8 text-neutral-700 leading-relaxed [&_p]:mb-3 [&_p:last-child]:mb-0"
          />
        )}
        {bioHtml && moreToRead && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-neutral-500 hover:text-neutral-900 underline-offset-2 hover:underline">
              {publicT(L, 'more_about', { name })}
            </summary>
            <RichText
              html={bioHtml}
              className="mt-4 text-neutral-700 leading-relaxed [&_p]:mb-3 [&_p:last-child]:mb-0"
            />
          </details>
        )}

        <MeetingTypeList slug={host.slug} items={host.meeting_types} L={L} />
        <Footer L={L} />
      </div>
    </main>
  );
}

function TeamView({ team, L }: { team: Team; L: Locale }) {
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <WorkspaceLine workspace={team.workspace} className="mb-6" />
        <header>
          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            {publicT(L, 'team_label')}
          </div>
          <h1 className="mt-2 text-2xl font-medium tracking-tight">{team.name}</h1>
        </header>
        {team.description && (
          <p className="mt-8 text-neutral-700 leading-relaxed whitespace-pre-wrap">
            {team.description}
          </p>
        )}
        <MeetingTypeList slug={team.slug} items={team.meeting_types} L={L} />
        <Footer L={L} />
      </div>
    </main>
  );
}

function MeetingTypeList({
  slug,
  items,
  L,
}: {
  slug: string;
  items: MeetingType[];
  L: Locale;
}) {
  return (
    <section className="mt-12">
      <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
        {publicT(L, 'book_a_meeting')}
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">
          {publicT(L, 'no_meeting_types')}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-200 border border-neutral-200 rounded-lg overflow-hidden">
          {items.map((mt) => (
            <li key={mt.id}>
              <Link
                href={`/${slug}/${mt.slug}`}
                className="block px-5 py-4 hover:bg-neutral-50"
              >
                <div className="flex items-baseline justify-between gap-6">
                  <div className="min-w-0">
                    <div className="font-medium">{mt.name}</div>
                    {mt.description && (
                      <p className="text-sm text-neutral-600 mt-1">
                        {mt.description}
                      </p>
                    )}
                  </div>
                  <div className="text-sm text-neutral-500 whitespace-nowrap">
                    {publicT(L, 'minutes_short', { n: String(mt.duration_minutes) })}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function Footer({ L }: { L: Locale }) {
  // The host decides staging vs production when no env var says so.
  const host = (await headers()).get('host');
  return (
    <footer className="mt-20 border-t border-neutral-200 pt-6 text-xs text-neutral-500">
      {/* The product is The Thread; Meet is what this page is (Sjoerd,
          2026-09-23). The link goes to the front door, not back to the app
          the visitor is already standing in. */}
      {publicT(L, 'powered_by')}{' '}
      <Link
        className="underline"
        href={surfaceUrl('website', { NEXT_PUBLIC_WEBSITE_URL: process.env.NEXT_PUBLIC_WEBSITE_URL }, host)}
      >
        {ENTITY.publicName}: {APPS['fibre-meet'].name}
      </Link>
    </footer>
  );
}
