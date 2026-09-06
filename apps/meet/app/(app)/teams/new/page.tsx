import {
  PageContainer,
  Breadcrumb,
  PageHeader,
} from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { TeamForm } from '../form';

export default async function NewTeamPage() {
  const locale = await uiLocale();
  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/teams" label={t(locale, 'teams_title')} />
      <PageHeader
        title={t(locale, 'new_team')}
        description={t(locale, 'new_team_desc')}
      />
      <div className="mt-10">
        <TeamForm initial={{}} locale={locale} />
      </div>
    </PageContainer>
  );
}
