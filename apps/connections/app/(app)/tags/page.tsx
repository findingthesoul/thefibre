import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, PageHeader, ErrorBanner } from '@thefibre/shared/ui/page';
import { uiLocale } from '@/lib/locale';
import { t, type Locale } from '@/lib/i18n-ui';
import { TagCloud, type TagRow } from './cloud';

// The words this workspace connects people with.
//
// Sjoerd asked for this three ways in one breath — *"could be in the form of a
// list... or in the form of visual cloud"*, *"or maybe even a map
// (landcard)"* — and they are one dataset with different renderings. Both are
// here, on one page, because they answer different questions: the cloud shows
// relative weight at a glance, the list gives exact numbers and provenance.
//
// The map is the desktop landscape (connections-desktop.md) and is not this.
// It wants edges between PEOPLE, which tags now finally provide a source for;
// drawing it over a handful of tags would be a diagram of nothing.

export default async function TagsPage() {
  const locale = (await uiLocale()) as Locale;

  let tags: TagRow[] = [];
  let totalPeople = 0;
  let error: string | null = null;
  try {
    const [tagsRes, land] = await Promise.all([
      apiFetch<{ tags: TagRow[] }>('/api/v1/connections/tags?min_people=1'),
      // The denominator the rarity rule needs. Never fatal — without it every
      // tag renders at full strength, which is wrong but readable.
      apiFetch<{ total: number }>('/api/v1/connections/landscape?since_days=30').catch(() => ({
        total: 0,
      })),
    ]);
    tags = tagsRes.tags ?? [];
    totalPeople = land.total ?? 0;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer>
      <PageHeader title={t(locale, 'nav_tags')} />
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">{t(locale, 'tags_intro')}</p>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {!error && tags.length === 0 && (
        <p className="mt-8 text-sm text-ink-muted">{t(locale, 'tags_empty')}</p>
      )}

      {!error && tags.length > 0 && (
        <>
          <TagCloud tags={tags} totalPeople={totalPeople} locale={locale} />

          {/* The same data, exactly. A cloud is for the glance; this is for
              the question "how many, and where did it come from". */}
          <h2 className="mt-10 text-sm font-medium">{t(locale, 'tags_all')}</h2>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface-raised">
            {tags.map((tag) => (
              <li key={tag.id}>
                <Link
                  href={`/people?tag=${tag.id}`}
                  className="flex items-baseline justify-between gap-3 px-4 py-3 hover:bg-surface-sunken"
                >
                  <span className="flex min-w-0 items-baseline gap-2">
                    {/* An organisation tag is a different kind of thing and
                        says so — it leads somewhere with a profile. */}
                    {tag.organisation_id && (
                      <Building2 size={13} className="shrink-0 text-ink-subtle" />
                    )}
                    <span className="truncate text-sm font-medium">{tag.name}</span>
                  </span>
                  <span className="flex shrink-0 items-baseline gap-3 text-xs text-ink-muted tabular-nums">
                    {/* How many arrived from a sentence rather than by hand.
                        A vocabulary that grew itself and one that was curated
                        are different things to trust differently. */}
                    {tag.from_notes > 0 && (
                      <span className="text-ink-subtle">
                        {t(locale, 'tags_from_notes', { n: tag.from_notes })}
                      </span>
                    )}
                    <span>{tag.people}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </PageContainer>
  );
}
