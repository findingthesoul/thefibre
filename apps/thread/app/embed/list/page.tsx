import { CalendarRange, Route } from 'lucide-react';
import { publicFetch } from '@/lib/public-api';
import { t, isLocale, type Locale } from '@/lib/i18n';
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
  language: string;
  public_interaction: 'page' | 'popup';
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

function fmtPrice(cents: number | null, currency: string | null, locale: Locale): string {
  if (!cents) return t(locale, 'free');
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
  // ?lang= (from data-lang) forces the UI language for the whole list.
  // Without it the list chrome is English, but each item's CTA + popup
  // follow the thread's own language.
  const rawLang = str(sp.lang);
  const forcedLang: Locale | undefined = isLocale(rawLang) ? rawLang : undefined;
  const chromeLang: Locale = forcedLang ?? 'en';

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
    return <p className="text-sm text-ink-subtle">{t(chromeLang, 'nothing_public')}</p>;
  }

  return (
    <ul className={compact ? 'space-y-2' : 'space-y-3'}>
      {items.map((item) => {
        const Icon = item.format === 'journey' ? Route : CalendarRange;
        const dates = fmtDates(item.starts_on, item.ends_on);
        // data-lang wins; otherwise the item speaks its thread's language.
        const itemLang: Locale =
          forcedLang ?? (isLocale(item.language) ? item.language : 'en');
        return (
          <li
            key={item.id}
            className={`rounded-xl border border-line bg-surface-raised overflow-hidden ${
              compact ? 'p-3' : 'p-4'
            }`}
          >
            <div className="flex items-start gap-3">
              {!compact && item.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.cover_url}
                  alt=""
                  className="h-16 w-16 rounded-lg object-cover ring-1 ring-line shrink-0"
                />
              ) : (
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-surface-sunken ring-1 ring-line shrink-0">
                  <Icon size={16} strokeWidth={1.75} className="text-ink-subtle" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className={`font-medium ${compact ? 'text-sm' : 'text-base'}`}>
                  {item.title}
                </div>
                {!compact && item.intention && (
                  <p className="mt-1 text-sm text-ink-subtle line-clamp-2 leading-relaxed">
                    {item.intention}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                  {dates && <span>{dates}</span>}
                  <span>{fmtPrice(item.price_cents, item.price_currency, itemLang)}</span>
                </div>
              </div>
              <ViewButton
                url={item.url}
                popup={popup && item.public_interaction === 'popup' && !!item.organiser_slug}
                organiser={item.organiser_slug ?? ''}
                thread={item.slug}
                lang={itemLang}
                label={t(itemLang, 'view_and_enrol')}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
