import { apiFetch } from '@/lib/api';
import { PageContainer, PageHeader, ErrorBanner } from '@thefibre/shared/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { EffortForm, type EffortKindRow } from './effort-form';

// How long things take here. connections-overview.md §3: estimates are
// defaulted by kind and never asked for on a task, so THIS is the one place a
// number is ever entered — once per kind, for the whole workspace.

export default async function EffortPage() {
  const locale = await uiLocale();

  let kinds: EffortKindRow[] = [];
  let canEdit = false;
  let error: string | null = null;
  try {
    const r = await apiFetch<{ kinds: EffortKindRow[]; can_edit: boolean }>('/api/v1/connections/effort');
    kinds = r.kinds ?? [];
    canEdit = r.can_edit;
  } catch {
    error = t(locale, 'effort_load_failed');
  }

  return (
    <PageContainer>
      <PageHeader title={t(locale, 'effort_card_title')} />
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">{t(locale, 'effort_intro')}</p>

      {error && <ErrorBanner>{error}</ErrorBanner>}
      {!error && !canEdit && (
        <p className="mt-6 text-sm text-ink-muted">{t(locale, 'admin_only_notice')}</p>
      )}
      {!error && <EffortForm kinds={kinds} locale={locale} canEdit={canEdit} />}
    </PageContainer>
  );
}
