import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, PageHeader, ErrorBanner } from '@thefibre/shared/ui/page';
import { uiLocale } from '@/lib/locale';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';
import { appUrl } from '@thefibre/shared';

type Condition =
  | 'went_quiet'
  | 'arrived_unattended'
  | 'finished_nothing_next'
  | 'ambassador_drifting'
  | 'carrying_too_much';

type Item = {
  person_id: string;
  condition: Condition;
  since: string | null;
  /** The fact that produced the row, already phrased. */
  detail: string;
  person: { first_name?: string | null; last_name?: string | null; email?: string | null } | null;
};

// Explicit map, not a computed key — the catalog is typed and a template
// key throws that guarantee away where it matters most.
const CONDITION_KEYS = {
  went_quiet: 'cond_went_quiet',
  arrived_unattended: 'cond_arrived_unattended',
  finished_nothing_next: 'cond_finished_nothing_next',
  ambassador_drifting: 'cond_ambassador_drifting',
  carrying_too_much: 'cond_carrying_too_much',
} as const;

function displayName(i: Item) {
  const p = i.person;
  if (!p) return i.person_id.slice(0, 8);
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.email || i.person_id.slice(0, 8);
}

export default async function AttentionPage() {
  const locale = (await uiLocale()) as Locale;

  let items: Item[] = [];
  let error: string | null = null;
  try {
    const r = await apiFetch<{ items: Item[] }>('/api/v1/connections/attention?limit=100');
    items = r.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  // Grouped by condition rather than mixed, because the conditions are
  // different kinds of work: a silence to break is not the same job as a
  // newcomer nobody welcomed.
  const groups = (Object.keys(CONDITION_KEYS) as Condition[])
    .map((c) => ({ condition: c, rows: items.filter((i) => i.condition === c) }))
    .filter((g) => g.rows.length > 0);

  return (
    <PageContainer>
      <PageHeader title={t(locale, 'nav_attention')} />
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">{t(locale, 'attention_intro')}</p>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {!error && items.length === 0 && (
        <p className="mt-8 text-sm text-ink-muted">{t(locale, 'attention_none')}</p>
      )}

      <div className="mt-8 space-y-8">
        {groups.map((g) => (
          <section key={g.condition}>
            <h2 className="text-sm font-medium">
              {t(locale, CONDITION_KEYS[g.condition])}
              <span className="ml-2 text-ink-muted tabular-nums">{g.rows.length}</span>
            </h2>
            <ul className="mt-2 space-y-1.5">
              {g.rows.map((i) => (
                <li
                  key={`${i.condition}-${i.person_id}`}
                  className="rounded-md border border-line bg-surface-raised px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    {/* Their profile lives on the platform, not here —
                        Connections owns no person data of its own. */}
                    <Link
                      href={`${appUrl('fibre-platform', process.env)}/contacts/${i.person_id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {displayName(i)}
                    </Link>
                    {i.since && (
                      <span className="text-xs text-ink-muted tabular-nums">
                        {new Intl.DateTimeFormat(INTL_LOCALES[locale], {
                          dateStyle: 'medium',
                        }).format(new Date(i.since))}
                      </span>
                    )}
                  </div>
                  {/* The reason, in words. Never a score — see D25. */}
                  <p className="mt-1 text-xs text-ink-muted">{i.detail}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PageContainer>
  );
}
