import { PageContainer, PageHeader, Breadcrumb } from '@/components/ui/page';
import { NewTeamForm } from './form';

export default function NewTeamPage() {
  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/teams" label="Teams" />
      <PageHeader
        title="New team"
        description="A shared group that organises threads together. You become its first lead."
      />
      <NewTeamForm />
    </PageContainer>
  );
}
