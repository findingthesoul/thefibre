import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, Breadcrumb, PageHeader } from '@/components/ui/page';
import { TabNav } from '@/components/ui/tabs';
import { APPS, APP_ORDER, isAppSlug } from '@/lib/apps';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { ContactActions, type EditablePerson } from './contact-actions';

export default async function ContactLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await uiLocale();

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
    t(locale, 'unnamed');

  const tabs = [
    { href: `/contacts/${id}`, label: t(locale, 'overview') },
    { href: `/contacts/${id}/profile`, label: t(locale, 'profile_title') },
    ...orderedApps
      .filter((slug) => slug !== 'fibre-platform')
      .map((slug) => ({
        href: `/contacts/${id}/app/${slug}`,
        label: APPS[slug].label,
      })),
  ];

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/contacts" label={t(locale, 'nav_contacts')} />
      <PageHeader
        title={fullName}
        description={
          person.preferred_name
            ? t(locale, 'goes_by', { name: person.preferred_name })
            : undefined
        }
        actions={<ContactActions person={person} locale={locale} />}
      />
      <TabNav tabs={tabs} />
      <div className="mt-8">{children}</div>
    </PageContainer>
  );
}
