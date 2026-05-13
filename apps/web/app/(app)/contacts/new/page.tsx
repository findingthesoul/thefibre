import { PageContainer, Breadcrumb, PageHeader } from '@/components/ui/page';
import { NewPersonForm } from './form';

export default function NewPersonPage() {
  return (
    <PageContainer max="md">
      <Breadcrumb href="/contacts" label="Contacts" />
      <PageHeader
        title="Add person"
        description="Adds a contact to your workspace. Identity is platform-owned — every app sees the same record."
      />
      <NewPersonForm />
    </PageContainer>
  );
}
