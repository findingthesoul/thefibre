import { PageContainer, Breadcrumb, PageHeader } from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { NewOrgForm } from './form';

export default async function NewOrgPage() {
  const locale = await uiLocale();
  return (
    <PageContainer max="md">
      <Breadcrumb href="/organisations" label={t(locale, 'nav_organisations')} />
      <PageHeader
        title={t(locale, 'add_organisation')}
        description={t(locale, 'add_organisation_blurb')}
      />
      <NewOrgForm locale={locale} />
    </PageContainer>
  );
}
