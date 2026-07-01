import { PageContainer, PageHeader, EmptyState } from '@/components/ui/page';

export default function EnrolmentsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Enrolments"
        description="Everyone enrolled across your threads — payment state, progress, approvals."
      />
      <EmptyState>
        Enrolments land with the public pages phase — once people can enrol,
        they show up here.
      </EmptyState>
    </PageContainer>
  );
}
