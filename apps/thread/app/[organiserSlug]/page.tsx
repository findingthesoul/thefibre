import { notFound } from 'next/navigation';
import { publicFetch, PublicApiError } from '@/lib/public-api';
import { ThreadsGrid, type PublicThreadListItem } from './threads-grid';

type PublicOrganiser = {
  id: string;
  slug: string;
  display_name: string | null;
  bio: string | null;
  photo_url: string | null;
};

type PublicThread = {
  id: string;
  slug: string;
  intention: string | null;
  price_cents: number | null;
  price_currency: string | null;
  program:
    | { title: string; format: string; status: string; starts_on: string | null; ends_on: string | null }
    | { title: string; format: string; status: string; starts_on: string | null; ends_on: string | null }[]
    | null;
};

export default async function PublicOrganiserPage({
  params,
}: {
  params: Promise<{ organiserSlug: string }>;
}) {
  const { organiserSlug } = await params;

  let data: { organiser: PublicOrganiser; threads: PublicThread[] };
  try {
    data = await publicFetch(`/api/v1/thread/public/organiser/${organiserSlug}`);
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) notFound();
    throw e;
  }

  const { organiser, threads } = data;
  const name = organiser.display_name ?? organiser.slug;

  return (
    <div className="min-h-screen bg-surface-sunken">
      <main className="mx-auto max-w-2xl px-6 py-16">
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
            <h1 className="text-2xl font-medium tracking-tight">{name}</h1>
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
          <ThreadsGrid organiserSlug={organiser.slug} threads={threads as PublicThreadListItem[]} />
        </section>

        <footer className="mt-16 text-xs text-ink-muted">
          Powered by <span className="font-medium">The Thread</span> · The Fibre
        </footer>
      </main>
    </div>
  );
}
