import { PageContainer, Breadcrumb, PageHeader } from '@/components/ui/page';
import { NewOrgForm } from './form';

export default function NewOrgPage() {
  return (
    <PageContainer max="md">
      <Breadcrumb href="/organisations" label="Organisations" />
      <PageHeader
        title="Add organisation"
        description="Adds an organisation to your workspace."
      />
      <NewOrgForm />
    </PageContainer>
  );
}
