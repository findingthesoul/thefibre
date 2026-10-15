import { CalendarRange, Route } from 'lucide-react';
import { publicFetch } from '@/lib/public-api';
import { richTextPreview } from '@/lib/rich-text-preview';
import { t, isLocale, type Locale } from '@/lib/i18n';
import { ViewButton } from './view-button';
import { FilteredList, type Card } from './filtered-list';
import { parseFilters } from '@/lib/embed-filters';
import { INTL_LOCALES } from '@thefibre/shared/i18n';
import { DEFAULT_CARD_DATES, cardDateLine, cardDatesFromParams, toCardDates, type CardDates } from '@thefibre/shared/thread-dates';

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
  /** Additive (2026-10-16); absent on an older API. */
  team?: { slug: string; name: string } | null;
  categories?: { slug: string; name: string }[];
  /** Thread dates (additive): the public event dates; absent on an older API. */
  event_starts_at?: string | null;
  event_ends_at?: string | null;
  key_moment_count?: number;
  /** The thread's zone (additive, part 3), to say event dates in. */
  timezone?: string;
  signups_close_at?: string | null;
};

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
  const workspace = str(sp.workspace);
  const format = str(sp.format);
  const category = str(sp.category);
  // The site owner's include/exclude (server-side) and the visitor filters
  // to show (client-side) — data-exclude-category, data-exclude-team,
  // data-filters on the snippet.
  const excludeCategory = str(sp.excludeCategory);
  const excludeTeam = str(sp.excludeTeam);
  const filters = parseFilters(str(sp.filters));
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

  if (!organiser && !team && !org && !workspace) {
    return (
      <p className="text-sm text-ink-subtle">
        Missing filter — pass <code>organiser</code>, <code>team</code>, <code>org</code> or{' '}
        <code>workspace</code>.
      </p>
    );
  }

  const qs = new URLSearchParams();
  if (organiser) qs.set('organiser', organiser);
  if (team) qs.set('team', team);
  if (org) qs.set('org', org);
  if (workspace) qs.set('workspace', workspace);
  if (format === 'event' || format === 'journey') qs.set('format', format);
  if (category) qs.set('category', category);
  if (excludeCategory) qs.set('exclude_category', excludeCategory);
  if (excludeTeam) qs.set('exclude_team', excludeTeam);

  let items: EmbedThreadItem[] = [];
  let truncated = false;
  let cardChoice: CardDates = DEFAULT_CARD_DATES;
  try {
    const data = await publicFetch<{ items: EmbedThreadItem[]; truncated?: boolean; card_dates?: unknown }>(
      `/api/v1/thread/public/embed/threads?${qs.toString()}`,
    );
    items = data.items ?? [];
    truncated = data.truncated === true;
    // What the cards show: the workspace's choice, then this embed's own
    // data-dates / data-sessions / data-signup-by on top.
    cardChoice = cardDatesFromParams(toCardDates(data.card_dates), {
      dates: str(sp.dates),
      sessions: str(sp.sessions),
      signupBy: str(sp.signupBy),
    });
  } catch {
    return <p className="text-sm text-ink-subtle">Couldn&apos;t load threads right now.</p>;
  }

  if (items.length === 0) {
    return <p className="text-sm text-ink-subtle">{t(chromeLang, 'nothing_public')}</p>;
  }

  const cards: Card[] = items.map((item) => {
        const Icon = item.format === 'journey' ? Route : CalendarRange;
        // data-lang wins; otherwise the item speaks its thread's language.
        const itemLang: Locale =
          forcedLang ?? (isLocale(item.language) ? item.language : 'en');
        // Thread dates part 3: one rule for every card (@thefibre/shared).
        const dates = cardDateLine(item, cardChoice, {
          locale: itemLang,
          intlLocale: INTL_LOCALES[itemLang],
          timeZone: item.timezone ?? 'Europe/Amsterdam',
        });
        const node = (
          <li
            key={item.id}
            className={`te-card rounded-xl border border-line bg-surface-raised overflow-hidden ${
              compact ? 'p-3' : 'p-4'
            }`}
          >
            <div className="flex items-start gap-3">
              {!compact && item.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.cover_url}
                  alt=""
                  className="te-cover h-16 w-16 rounded-lg object-cover ring-1 ring-line shrink-0"
                />
              ) : (
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-surface-sunken ring-1 ring-line shrink-0">
                  <Icon size={16} strokeWidth={1.75} className="text-ink-subtle" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className={`te-title font-medium ${compact ? 'text-sm' : 'text-base'}`}>
                  {item.title}
                </div>
                {!compact && item.intention && (
                  <p className="te-intention mt-1 text-sm text-ink-subtle line-clamp-2 leading-relaxed">
                    {richTextPreview(item.intention)}
                  </p>
                )}
                <div className="te-meta mt-1.5 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
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
    return {
      id: item.id,
      starts_on: item.starts_on,
      ends_on: item.ends_on,
      team: item.team ?? null,
      categories: item.categories ?? [],
      language: item.language,
      node,
    };
  });

  return (
    <>
      {/* More threads exist than one response carries: say so, and offer no
          visitor filters — a filter must never run over a partial list. */}
      {truncated && <p className="te-truncated mb-2 text-xs text-ink-muted">{t(chromeLang, 'list_truncated', { n: String(items.length) })}</p>}
      <FilteredList cards={cards} filters={truncated ? [] : filters} locale={chromeLang} compact={compact} />
    </>
  );
}
