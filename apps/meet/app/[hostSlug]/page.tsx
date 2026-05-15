import Link from 'next/link';
import { notFound } from 'next/navigation';
import { publicFetch, PublicApiError } from '@/lib/public-api';

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
  id: string;
  slug: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  photo_url: string | null;
  location: string | null;
  timezone: string;
  meeting_types: MeetingType[];
};

type Team = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
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
  if (host) return <HostView host={host} />;

  // Fall back to team.
  let team: Team | null = null;
  try {
    team = await publicFetch<Team>(`/api/v1/meet/public/team/${encodeURIComponent(slug)}`);
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) notFound();
    throw e;
  }
  if (!team) notFound();
  return <TeamView team={team} />;
}

function HostView({ host }: { host: Host }) {
  const photo = host.photo_url ?? host.avatar_url;
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <header className="flex items-center gap-5">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt={host.full_name ?? host.slug}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400">
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

        {host.bio && (
          <p className="mt-8 text-neutral-700 leading-relaxed whitespace-pre-wrap">
            {host.bio}
          </p>
        )}

        <MeetingTypeList slug={host.slug} items={host.meeting_types} />
        <Footer />
      </div>
    </main>
  );
}

function TeamView({ team }: { team: Team }) {
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <header>
          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            Team
          </div>
          <h1 className="mt-2 text-2xl font-medium tracking-tight">{team.name}</h1>
        </header>
        {team.description && (
          <p className="mt-8 text-neutral-700 leading-relaxed whitespace-pre-wrap">
            {team.description}
          </p>
        )}
        <MeetingTypeList slug={team.slug} items={team.meeting_types} />
        <Footer />
      </div>
    </main>
  );
}

function MeetingTypeList({
  slug,
  items,
}: {
  slug: string;
  items: MeetingType[];
}) {
  return (
    <section className="mt-12">
      <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
        Book a meeting
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">
          No meeting types available yet.
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
                    {mt.duration_minutes} min
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

function Footer() {
  return (
    <footer className="mt-20 border-t border-neutral-200 pt-6 text-xs text-neutral-500">
      Powered by{' '}
      <Link className="underline" href="https://meet.thefibre.app">
        Fibre Meet
      </Link>
    </footer>
  );
}
