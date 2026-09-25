import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { PageContainer, PageHeader, EmptyState, ErrorBanner, SectionLabel } from '@thefibre/shared/ui/page';
import { CARD, PILL, PILL_TONE } from '@thefibre/shared/ui/recipes';
import { INTL_LOCALES } from '@/lib/i18n-ui';
import type { ModelListItem } from '../models/actions';
import { listTeams } from '../models/actions';
import { NewModelButton } from './new-model';

export const metadata = { title: 'Business models' };

export default async function ModelsDashboard() {
  const locale = await uiLocale();
  let items: ModelListItem[] = [];
  let isAdmin = false;
  let failed = false;
  try {
    const r = await apiFetch<{ items: ModelListItem[]; is_admin: boolean }>('/api/v1/models');
    items = r.items ?? [];
    isAdmin = r.is_admin;
  } catch {
    failed = true;
  }
  const teams = await listTeams();
  const canCreate = isAdmin || teams.items.some((tm) => tm.role === 'admin' || tm.role === 'lead');

  // Grouped by team; workspace wide models first.
  const groups = new Map<string, { label: string; items: ModelListItem[] }>();
  for (const m of items) {
    const key = m.team?.id ?? '';
    const label = m.team?.name ?? t(locale, 'workspace_wide');
    const g = groups.get(key) ?? { label, items: [] };
    g.items.push(m);
    groups.set(key, g);
  }
  const dateFmt = new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <PageContainer>
      <PageHeader
        title={t(locale, 'models_title')}
        description={t(locale, 'models_blurb')}
        actions={canCreate ? <NewModelButton teams={teams.items} isAdmin={teams.is_admin} /> : null}
      />
      {failed && <div className="mt-6"><ErrorBanner>{t(locale, 'load_failed')}</ErrorBanner></div>}
      {!failed && items.length === 0 && (
        <div className="mt-8">
          <EmptyState>
            <div className="text-base font-medium text-ink">{t(locale, 'no_models_title')}</div>
            <p className="mt-1 max-w-prose mx-auto">{t(locale, 'no_models_blurb')}</p>
          </EmptyState>
        </div>
      )}
      {Array.from(groups.entries()).map(([key, g]) => (
        <section key={key || 'workspace'} className="mt-8">
          <SectionLabel>{g.label}</SectionLabel>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((m) => (
              <Link key={m.id} href={`/models/${m.id}`} className={`${CARD} block p-4 hover:bg-surface-sunken transition-colors`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-base font-medium tracking-tight truncate">{m.name}</div>
                    {m.tagline && <div className="mt-0.5 text-sm text-ink-subtle italic truncate">{m.tagline}</div>}
                  </div>
                  <span className={`${PILL} ${PILL_TONE.neutral} shrink-0`}>{m.team?.name ?? t(locale, 'workspace_wide')}</span>
                </div>
                {m.description && <p className="mt-2 text-sm text-ink-subtle line-clamp-2">{m.description}</p>}
                <div className="mt-3 text-[11px] text-ink-muted tracking-wider uppercase">
                  {t(locale, 'updated')} {dateFmt.format(new Date(m.updated_at))}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </PageContainer>
  );
}
