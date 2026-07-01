import { PageContainer, PageHeader, EmptyState } from '@/components/ui/page';

export default function CertificatesPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Certificates"
        description="Templates and issued certificates across your threads."
      />
      <EmptyState>
        The certificate designer lands in its own phase — templates, issuance
        and the public certificate page.
      </EmptyState>
    </PageContainer>
  );
}
