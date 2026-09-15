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

  // The person's organisations, so a work address can say which one it is for.
  let organisations: { id: string; name: string }[] = [];
  try {
    const m = await apiFetch<{ org_memberships: { ended_at: string | null; organisation: { id: string; name: string } | null }[] }>(
      `/api/v1/persons/${id}/memberships`,
    );
    organisations = m.org_memberships
      .filter((x) => !x.ended_at && x.organisation)
      .map((x) => x.organisation!);
  } catch {
    // Non-fatal: the editor just offers no organisation.
  }

  let appSlugs: string[] = [];
  try {
    const r = await apiFetch<{ apps: string[] }>(`/api/v1/persons/${id}/apps`);
    appSlugs = r.apps;
  } catch {
    // Non-fatal — no app tabs if endpoint fails.
  }

  // Invoices (2026-09-14) appears the way the app tabs do: only when there
  // is something behind it. Asked as the workspace first; a non-admin is
  // refused that and asked again as themselves, so the tab shows for an
  // organiser exactly when they have sold this person something.
  const hasInvoices = await personHasVisibleInvoices(id);

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
    ...(hasInvoices ? [{ href: `/contacts/${id}/invoices`, label: t(locale, 'nav_invoices') }] : []),
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
        actions={<ContactActions person={person} organisations={organisations} locale={locale} />}
      />
      <TabNav tabs={tabs} />
      <div className="mt-8">{children}</div>
    </PageContainer>
  );
}

async function personHasVisibleInvoices(personId: string): Promise<boolean> {
  for (const scope of ['workspace', 'me'] as const) {
    try {
      const r = await apiFetch<{ totals?: { count?: number } }>(
        `/api/v1/purchases?scope=${scope}&person_id=${encodeURIComponent(personId)}`,
      );
      return (r.totals?.count ?? 0) > 0;
    } catch (e) {
      // 403 = not an admin; try as themselves. Anything else: no tab, and
      // the profile still renders — a missing tab beats a broken page.
      if (e instanceof ApiError && e.status === 403 && scope === 'workspace') continue;
      return false;
    }
  }
  return false;
}
