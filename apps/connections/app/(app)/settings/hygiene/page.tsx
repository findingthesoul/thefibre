import { apiFetch } from '@/lib/api';
import { PageContainer, PageHeader, ErrorBanner } from '@thefibre/shared/ui/page';
import { uiLocale } from '@/lib/locale';
import { t, type Locale } from '@/lib/i18n-ui';
import { HygieneList, type Finding } from './hygiene-list';

// What the nightly sweep found.
//
// Two lists: things waiting for a judgement, and safe fixes already applied.
// The second exists because an unlogged change is exactly what this design
// refuses — docs/connections-data-integrity.md §9.3.
//
// Admin-only, enforced in RLS rather than here. A member's read simply comes
// back empty, which renders as "nothing to review" — accurate for them.

export default async function HygienePage() {
  const locale = (await uiLocale()) as Locale;

  let items: Finding[] = [];
  let error: string | null = null;
  try {
    // Two reads because the queue and the audit trail are different questions
    // with different filters. Both are small and they go in parallel.
    const [open, fixed] = await Promise.all([
      apiFetch<{ items: Finding[] }>('/api/v1/connections/hygiene?status=open&limit=100'),
      apiFetch<{ items: Finding[] }>('/api/v1/connections/hygiene?status=fixed&limit=50'),
    ]);
    items = [...open.items, ...fixed.items];
  } catch {
    error = t(locale, 'hyg_load_failed');
  }

  return (
    <PageContainer>
      <PageHeader title={t(locale, 'hyg_card_title')} />
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">{t(locale, 'hyg_intro')}</p>
      <p className="mt-2 max-w-2xl text-sm text-ink-subtle">{t(locale, 'hyg_never_invents')}</p>

      {error && <ErrorBanner>{error}</ErrorBanner>}
      {!error && <HygieneList items={items} locale={locale} canAct />}
    </PageContainer>
  );
}
