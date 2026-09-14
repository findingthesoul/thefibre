import { PageContainer, PageHeader, ErrorBanner } from '@thefibre/shared/ui/page';
import { uiLocale } from '@/lib/locale';
import { t, type Locale } from '@/lib/i18n-ui';
import { loadTagCleaning } from './actions';
import { TagCleaningList } from './tag-cleaning';

// Tag cleaning: doubles, tags on nobody, tags not used for months.
// Sjoerd, 2026-09-14 (ask 60). Everyone can look; workspace admins can act,
// because changing the vocabulary changes it for the whole workspace.

export default async function TagCleaningPage() {
  const locale = (await uiLocale()) as Locale;
  const data = await loadTagCleaning();
  return (
    <PageContainer>
      <PageHeader title={t(locale, 'tagclean_card_title')} />
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">{t(locale, 'tagclean_intro')}</p>
      {data ? <TagCleaningList data={data} locale={locale} /> : <ErrorBanner>{t(locale, 'tagclean_load_failed')}</ErrorBanner>}
    </PageContainer>
  );
}
