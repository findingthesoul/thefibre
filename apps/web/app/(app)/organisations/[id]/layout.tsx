import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, Breadcrumb, PageHeader } from '@/components/ui/page';
import { TabNav } from '@/components/ui/tabs';
import { APPS, APP_ORDER, isAppSlug } from '@/lib/apps';
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

  let appSlugs: string[] = [];
  try {
    const r = await apiFetch<{ apps: string[] }>(`/api/v1/organisations/${id}/apps`);
    appSlugs = r.apps;
  } catch {
    // Non-fatal — no app tabs if endpoint fails.
  }

  const orderedApps = APP_ORDER.filter(
    (slug) => appSlugs.includes(slug) && isAppSlug(slug),
  );

  const tabs = [
    { href: `/organisations/${id}`, label: 'Overview' },
    { href: `/organisations/${id}/profile`, label: 'Profile' },
    ...orderedApps
      .filter((slug) => slug !== 'fibre-platform')
      .map((slug) => ({
        href: `/organisations/${id}/app/${slug}`,
        label: APPS[slug].label,
      })),
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
