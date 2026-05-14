import { PageContainer, Breadcrumb, PageHeader } from '@/components/ui/page';
import { NewProgrammeForm } from './form';

export default function NewProgrammePage() {
  return (
    <PageContainer max="md">
      <Breadcrumb href="/programmes" label="Programmes" />
      <PageHeader
        title="New programme"
        description="A programme is an event, journey, meeting, or course. The format determines which app delivers it."
      />
      <NewProgrammeForm />
    </PageContainer>
  );
}
