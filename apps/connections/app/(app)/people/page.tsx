import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, PageHeader, ErrorBanner } from '@thefibre/shared/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { PeopleList, type Person } from './people-list';
import { isAxis, type Axis, type BandLabels } from '../landscape/axes';

// Everyone this workspace knows, as a list you can search and open.
//
// The landscape shows proportions; this shows people. They are different
// jobs and neither replaces the other — the reason to come here is to find
// one person and write down what was said.
//
// Paging is by CURSOR, never an offset (hard rule 6). "Load more" bumps a
// page COUNT in the URL and this walks that many cursors server-side, so the
// accumulated list survives a reload and a shared link, and no page number
// is ever turned into a row offset.

const PAGE_SIZE = 100; // the API's own maximum
const MAX_PAGES = 10;

type PersonsPage = { items: Person[]; next: string | null };

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pages?: string; axis?: string; band?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  // Arriving from a band on the landscape. An unknown axis falls back rather
  // than 404s, the same rule the landscape itself uses for a stale bookmark.
  const axis: Axis = isAxis(sp.axis) ? sp.axis : 'maturity';
  const band = (sp.band ?? '').trim() || null;
  const wanted = Math.min(Math.max(Number.parseInt(sp.pages ?? '1', 10) || 1, 1), MAX_PAGES);
  const locale = await uiLocale();

  // Started here and awaited at the bottom, so the names travel alongside the
  // people rather than after them. Cosmetic and independent of everything
  // else on the page: a workspace that has renamed nothing gets an empty
  // object and every chip falls back to its shipped translation, which is why
  // this one swallows its own failure instead of reaching the error banner.
  const labelsPromise = apiFetch<{ labels: BandLabels }>('/api/v1/connections/labels')
    .then((r) => r.labels)
    .catch(() => undefined);

  const items: Person[] = [];
  let cursor: string | null = null;
  let error: string | null = null;

  try {
    for (let i = 0; i < wanted; i += 1) {
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (q) qs.set('q', q);
      if (cursor) qs.set('after', cursor);
      const page: PersonsPage = await apiFetch<PersonsPage>(`/api/v1/persons?${qs.toString()}`);
      items.push(...page.items);
      cursor = page.next;
      if (!cursor) break;
    }
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  // One landscape read serves two purposes and is fetched ONCE, not per row:
  //
  //   - `total`: how many people exist at all. The list only ever holds a
  //     window of them, and "37 people" when there are 412 would be a lie.
  //     Meaningless next to a filtered list, so it is only shown unfiltered.
  //   - `people`: where each person stands on the maturity ladder, indexed by
  //     id here so the list can put a band on every row. The call returns
  //     EVERY person in one go, which is why it is cheaper than asking per
  //     row and why it covers rows on later pages too.
  //
  // Maturity unless the landscape sent us here on another axis. There is
  // still no picker on this page: the axis arrives in the URL from the band
  // that was tapped, so the two surfaces can never disagree about what a
  // band means — they are reading the same call with the same argument.
  //
  // Never fatal: a list without bands is still a list. But a list that was
  // ASKED for one band and could not fetch the bands would be a filter
  // silently doing nothing, so that case drops the filter and says so.
  let total: number | null = null;
  let rungById: Record<string, string> = {};
  let bandsUnavailable = false;
  try {
    const l = await apiFetch<{ total: number; people?: { person_id: string; rung: string }[] }>(
      `/api/v1/connections/landscape?since_days=30&axis=${axis}&people=1`,
    );
    if (!q) total = l.total;
    rungById = Object.fromEntries((l.people ?? []).map((p) => [p.person_id, p.rung]));
  } catch {
    total = null;
    rungById = {};
    bandsUnavailable = true;
  }

  // Filtering happens over the rows already loaded, which is a real limit
  // worth naming: with more people than the loaded window holds, somebody in
  // this band can sit on a page nobody has asked for yet. Load more still
  // works and still extends the filtered list, and `bandTotal` below comes
  // from the landscape rather than from the rows, so the count on screen is
  // the true size of the band and not the size of what happened to load.
  const labels = await labelsPromise;
  const bandTotal = band ? Object.values(rungById).filter((r) => r === band).length : null;
  const shown = band && !bandsUnavailable ? items.filter((p) => rungById[p.id] === band) : items;

  return (
    <PageContainer>
      <PageHeader title={t(locale, 'nav_people')} />
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">{t(locale, 'people_intro')}</p>

      {error && <ErrorBanner>{t(locale, 'people_load_failed')} {error}</ErrorBanner>}

      {!error && (
        <PeopleList
          items={shown}
          q={q}
          total={total}
          rungById={rungById}
          axis={axis}
          labels={labels}
          band={band}
          bandTotal={bandTotal}
          hasMore={cursor !== null}
          nextPages={Math.min(wanted + 1, MAX_PAGES)}
          locale={locale}
        />
      )}
    </PageContainer>
  );
}
