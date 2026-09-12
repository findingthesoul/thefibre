import { apiFetch } from '@/lib/api';
import { PageContainer, PageHeader, ErrorBanner } from '@thefibre/shared/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import type { BandLabels } from '../../landscape/axes';
import { NamesForm } from './names-form';

// What this workspace calls its bands.
//
// The page says out loud what it does NOT do, because that is the part people
// will look for: the rules are derived and are not editable here or anywhere.
// Leaving that unsaid would make the absence of those controls read as an
// unfinished screen rather than as the decision it is.

export default async function NamesPage() {
  const locale = await uiLocale();

  let labels: BandLabels = {};
  let canEdit = false;
  let error: string | null = null;
  try {
    const r = await apiFetch<{ labels: BandLabels; can_edit: boolean }>(
      '/api/v1/connections/labels',
    );
    labels = r.labels ?? {};
    canEdit = r.can_edit;
  } catch {
    error = t(locale, 'names_load_failed');
  }

  return (
    <PageContainer>
      <PageHeader title={t(locale, 'names_card_title')} />
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">{t(locale, 'names_intro')}</p>
      <p className="mt-2 max-w-2xl text-sm text-ink-subtle">{t(locale, 'names_rules_fixed')}</p>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {!error && !canEdit && (
        <p className="mt-6 text-sm text-ink-muted">{t(locale, 'admin_only_notice')}</p>
      )}

      {!error && <NamesForm initial={labels} locale={locale} canEdit={canEdit} />}
    </PageContainer>
  );
}
