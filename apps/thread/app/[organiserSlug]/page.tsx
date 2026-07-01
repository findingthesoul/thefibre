import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarRange, Route } from 'lucide-react';
import { publicFetch, PublicApiError } from '@/lib/public-api';

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

function one<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function fmtDates(a: string | null, b: string | null): string | null {
  if (!a && !b) return null;
  const fmt = (d: string) =>
    new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(d),
    );
  if (a && b && a !== b) return `${fmt(a)} → ${fmt(b)}`;
  return fmt((a ?? b)!);
}

function fmtPrice(cents: number | null, currency: string | null): string {
  if (!cents) return 'Free';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency ?? 'EUR',
  }).format(cents / 100);
}

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
          <ul className="mt-3 space-y-3">
            {threads.map((t) => {
              const p = one(t.program);
              const Icon = p?.format === 'journey' ? Route : CalendarRange;
              const dates = fmtDates(p?.starts_on ?? null, p?.ends_on ?? null);
              return (
                <li key={t.id}>
                  <Link
                    href={`/${organiser.slug}/${t.slug}`}
                    className="flex items-start gap-4 rounded-xl border border-line bg-surface-raised p-5 hover:border-line-strong transition-colors"
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-surface-sunken ring-1 ring-line shrink-0">
                      <Icon size={18} strokeWidth={1.75} className="text-ink-subtle" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-medium">{p?.title ?? t.slug}</div>
                      {t.intention && (
                        <p className="mt-1 text-sm text-ink-subtle line-clamp-2 leading-relaxed">
                          {t.intention}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-xs text-ink-muted">
                        {dates && <span>{dates}</span>}
                        <span>{fmtPrice(t.price_cents, t.price_currency)}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <footer className="mt-16 text-xs text-ink-muted">
          Powered by <span className="font-medium">The Thread</span> · The Fibre
        </footer>
      </main>
    </div>
  );
}
