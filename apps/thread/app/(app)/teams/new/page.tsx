import { PageContainer, PageHeader, Breadcrumb } from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { NewTeamForm } from './form';

export default async function NewTeamPage() {
  const locale = await uiLocale();
  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/teams" label={t(locale, 'teams')} />
      <PageHeader title={t(locale, 'new_team')} description={t(locale, 'new_team_desc')} />
      <NewTeamForm locale={locale} />
    </PageContainer>
  );
}
