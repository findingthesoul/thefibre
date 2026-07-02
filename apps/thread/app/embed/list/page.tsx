import { CalendarRange, Route } from 'lucide-react';
import { publicFetch } from '@/lib/public-api';
import { ViewButton } from './view-button';

type EmbedThreadItem = {
  id: string;
  slug: string;
  organiser_slug: string | null;
  organiser_name: string | null;
  title: string;
  format: string;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  intention: string | null;
  cover_url: string | null;
  price_cents: number | null;
  price_currency: string | null;
  url: string;
};

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

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export default async function EmbedListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const organiser = str(sp.organiser);
  const team = str(sp.team);
  const org = str(sp.org);
  const compact = str(sp.compact) === '1';
  // `theme=light` is accepted (and is the only theme); other values are
  // ignored for now — the layout forces light regardless.
  const popup = str(sp.popup) === '1';

  if (!organiser && !team && !org) {
    return (
      <p className="text-sm text-ink-subtle">
        Missing filter — pass <code>organiser</code>, <code>team</code> or <code>org</code>.
      </p>
    );
  }

  const qs = new URLSearchParams();
  if (organiser) qs.set('organiser', organiser);
  if (team) qs.set('team', team);
  if (org) qs.set('org', org);

  let items: EmbedThreadItem[] = [];
  try {
    const data = await publicFetch<{ items: EmbedThreadItem[] }>(
      `/api/v1/thread/public/embed/threads?${qs.toString()}`,
    );
    items = data.items ?? [];
  } catch {
    return <p className="text-sm text-ink-subtle">Couldn&apos;t load threads right now.</p>;
  }

  if (items.length === 0) {
    return <p className="text-sm text-ink-subtle">Nothing public right now.</p>;
  }

  return (
    <ul className={compact ? 'space-y-2' : 'space-y-3'}>
      {items.map((t) => {
        const Icon = t.format === 'journey' ? Route : CalendarRange;
        const dates = fmtDates(t.starts_on, t.ends_on);
        return (
          <li
            key={t.id}
            className={`rounded-xl border border-line bg-surface-raised overflow-hidden ${
              compact ? 'p-3' : 'p-4'
            }`}
          >
            <div className="flex items-start gap-3">
              {!compact && t.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.cover_url}
                  alt=""
                  className="h-16 w-16 rounded-lg object-cover ring-1 ring-line shrink-0"
                />
              ) : (
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-surface-sunken ring-1 ring-line shrink-0">
                  <Icon size={16} strokeWidth={1.75} className="text-ink-subtle" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className={`font-medium ${compact ? 'text-sm' : 'text-base'}`}>{t.title}</div>
                {!compact && t.intention && (
                  <p className="mt-1 text-sm text-ink-subtle line-clamp-2 leading-relaxed">
                    {t.intention}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                  {dates && <span>{dates}</span>}
                  <span>{fmtPrice(t.price_cents, t.price_currency)}</span>
                </div>
              </div>
              <ViewButton url={t.url} popup={popup} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
