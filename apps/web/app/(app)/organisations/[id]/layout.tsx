import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, Breadcrumb, PageHeader } from '@/components/ui/page';
import { TabNav } from '@/components/ui/tabs';
import { OrgActions, type EditableOrg } from './org-actions';

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let org: EditableOrg & { legal_name: string | null };
  try {
    org = await apiFetch(`/api/v1/organisations/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const tabs = [
    { href: `/organisations/${id}`, label: 'Overview' },
    { href: `/organisations/${id}/identity`, label: 'Identity' },
    { href: `/organisations/${id}/system-context`, label: 'System context' },
    { href: `/organisations/${id}/relationship`, label: 'Relationship' },
  ];

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/organisations" label="Organisations" />
      <PageHeader
        title={org.name}
        description={org.legal_name && org.legal_name !== org.name ? org.legal_name : undefined}
        actions={<OrgActions org={org} />}
      />
      <TabNav tabs={tabs} />
      <div className="mt-8">{children}</div>
    </PageContainer>
  );
}
