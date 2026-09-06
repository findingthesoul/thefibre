import { PageContainer, Breadcrumb, PageHeader } from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { NewProgrammeForm } from './form';

export default async function NewProgrammePage() {
  const locale = await uiLocale();
  return (
    <PageContainer max="md">
      <Breadcrumb href="/programmes" label={t(locale, 'nav_programmes')} />
      <PageHeader
        title={t(locale, 'new_programme')}
        description={t(locale, 'new_programme_blurb')}
      />
      <NewProgrammeForm locale={locale} />
    </PageContainer>
  );
}
