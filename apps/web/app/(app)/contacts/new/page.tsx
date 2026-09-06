import { PageContainer, Breadcrumb, PageHeader } from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { NewPersonForm } from './form';

export default async function NewPersonPage() {
  const locale = await uiLocale();
  return (
    <PageContainer max="md">
      <Breadcrumb href="/contacts" label={t(locale, 'nav_contacts')} />
      <PageHeader
        title={t(locale, 'add_person')}
        description={t(locale, 'add_person_blurb')}
      />
      <NewPersonForm locale={locale} />
    </PageContainer>
  );
}
