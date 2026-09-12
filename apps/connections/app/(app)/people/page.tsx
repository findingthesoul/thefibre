import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, PageHeader, ErrorBanner } from '@thefibre/shared/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { PeopleList, type Person } from './people-list';

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
  searchParams: Promise<{ q?: string; pages?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const wanted = Math.min(Math.max(Number.parseInt(sp.pages ?? '1', 10) || 1, 1), MAX_PAGES);
  const locale = await uiLocale();

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
  // Only the maturity axis. The other axes are the landscape's to offer — a
  // second picker here would let the two surfaces disagree about what
  // "standing" means.
  //
  // Never fatal: a list without bands is still a list.
  let total: number | null = null;
  let rungById: Record<string, string> = {};
  try {
    const l = await apiFetch<{ total: number; people?: { person_id: string; rung: string }[] }>(
      '/api/v1/connections/landscape?since_days=30&people=1',
    );
    if (!q) total = l.total;
    rungById = Object.fromEntries((l.people ?? []).map((p) => [p.person_id, p.rung]));
  } catch {
    total = null;
    rungById = {};
  }

  return (
    <PageContainer>
      <PageHeader title={t(locale, 'nav_people')} />
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">{t(locale, 'people_intro')}</p>

      {error && <ErrorBanner>{t(locale, 'people_load_failed')} {error}</ErrorBanner>}

      {!error && (
        <PeopleList
          items={items}
          q={q}
          total={total}
          rungById={rungById}
          hasMore={cursor !== null}
          nextPages={Math.min(wanted + 1, MAX_PAGES)}
          locale={locale}
        />
      )}
    </PageContainer>
  );
}
