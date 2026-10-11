import { Plus, Search, CopyCheck } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { ButtonLink } from '@/components/ui/button';
import { PageContainer, PageHeader, EmptyState, ErrorBanner } from '@/components/ui/page';
import { NOTICE } from '@thefibre/shared/ui/recipes';
import { ListGroup, ListRow } from '@/components/ui/list';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';

type Organisation = {
  id: string;
  name: string;
  domain: string | null;
  short_name?: string | null;
  other_names?: string[] | null;
  country: string | null;
  sector: string | null;
  org_type: string | null;
  created_at: string;
};

export default async function OrganisationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const locale = await uiLocale();

  let items: Organisation[] = [];
  let ownId: string | null = null;
  let error: string | null = null;
  try {
    const data = await apiFetch<{ items: Organisation[]; workspace_organisation_id?: string | null }>(
      `/api/v1/organisations?limit=100${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    );
    ownId = data.workspace_organisation_id ?? null;
    // The organisation this workspace is comes first (Sjoerd, 2026-09-15).
    items = [...data.items].sort((a, b) => Number(b.id === ownId) - Number(a.id === ownId));
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  // Not while searching: a nudge about the whole workspace under a filtered
  // list is about something the person is not looking at.
  let possibleDuplicates = 0;
  if (!q) {
    try {
      const d = await apiFetch<{ items: unknown[] }>('/api/v1/organisations/duplicates?limit=50');
      possibleDuplicates = d.items.length;
    } catch {
      // Not an admin, or the queue is unavailable: no notice. Deliberately
      // silent — an organiser is not being told about a page they may not
      // open.
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title={t(locale, 'nav_organisations')}
        actions={
          <div className="flex items-center gap-2">
            {/* Admin-gated in the API; a non-admin who follows it is told so
                rather than shown an empty queue. */}
            <ButtonLink
              href="/organisations/duplicates"
              variant="secondary"
              leading={<CopyCheck size={14} strokeWidth={2} />}
            >
              {t(locale, 'dup_find')}
            </ButtonLink>
            <ButtonLink href="/organisations/new" leading={<Plus size={14} strokeWidth={2.25} />}>
              {t(locale, 'add_organisation')}
            </ButtonLink>
          </div>
        }
      />

      {possibleDuplicates > 0 && (
        <a href="/organisations/duplicates" className={`mt-6 block hover:underline ${NOTICE.info}`}>
          {possibleDuplicates === 1
            ? t(locale, 'odup_nudge_one')
            : t(locale, 'odup_nudge', {
                n: possibleDuplicates >= 50 ? '50+' : possibleDuplicates,
              })}
        </a>
      )}

      <form className="mt-6 relative" action="/organisations">
        <Search size={15} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder={t(locale, 'search_org_any_name')}
          className="w-full rounded-md border border-line bg-surface-raised pl-9 pr-3 py-2 text-sm placeholder:text-ink-muted focus:border-line-strong focus:outline-none"
        />
      </form>

      {error && <ErrorBanner>{t(locale, 'orgs_load_failed')} {error}</ErrorBanner>}

      {!error && items.length === 0 && (
        <EmptyState>
          {t(locale, 'no_orgs_yet')}{' '}
          <a href="/organisations/new" className="underline">{t(locale, 'add_first_one')}</a>.
        </EmptyState>
      )}

      {items.length > 0 && (
        <ListGroup>
          {items.map((o) => (
            <ListRow
              key={o.id}
              href={`/organisations/${o.id}`}
              primary={o.short_name && o.short_name !== o.name ? `${o.name} (${o.short_name})` : o.name}
              secondary={o.domain ?? [o.sector, o.org_type].filter(Boolean).join(' · ') ?? '—'}
              meta={o.id === ownId ? t(locale, 'org_this_workspace') : o.country ?? ''}
            />
          ))}
        </ListGroup>
      )}
    </PageContainer>
  );
}
