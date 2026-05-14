import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, Breadcrumb, PageHeader } from '@/components/ui/page';
import { TabNav } from '@/components/ui/tabs';
import { APPS, APP_ORDER, isAppSlug } from '@/lib/apps';
import { ContactActions, type EditablePerson } from './contact-actions';

export default async function ContactLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let person: EditablePerson & { preferred_name: string | null };
  try {
    person = await apiFetch(`/api/v1/persons/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  let appSlugs: string[] = [];
  try {
    const r = await apiFetch<{ apps: string[] }>(`/api/v1/persons/${id}/apps`);
    appSlugs = r.apps;
  } catch {
    // Non-fatal — no app tabs if endpoint fails.
  }

  const orderedApps = APP_ORDER.filter(
    (slug) => appSlugs.includes(slug) && isAppSlug(slug),
  );

  const fullName =
    [person.first_name, person.last_name].filter(Boolean).join(' ') ||
    person.email ||
    'Unnamed';

  const tabs = [
    { href: `/contacts/${id}`, label: 'Overview' },
    { href: `/contacts/${id}/profile`, label: 'Profile' },
    ...orderedApps
      .filter((slug) => slug !== 'fibre-platform')
      .map((slug) => ({
        href: `/contacts/${id}/app/${slug}`,
        label: APPS[slug].label,
      })),
  ];

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/contacts" label="Contacts" />
      <PageHeader
        title={fullName}
        description={person.preferred_name ? `Goes by ${person.preferred_name}` : undefined}
        actions={<ContactActions person={person} />}
      />
      <TabNav tabs={tabs} />
      <div className="mt-8">{children}</div>
    </PageContainer>
  );
}
