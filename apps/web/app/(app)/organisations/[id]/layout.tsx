import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, Breadcrumb, PageHeader } from '@/components/ui/page';
import { TabNav } from '@/components/ui/tabs';
import { APPS, APP_ORDER, isAppSlug } from '@/lib/apps';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { OrgActions, type EditableOrg } from './org-actions';

// Tiny header avatar — renders the org logo if the URL is set, otherwise a
// neutral letter tile so the layout stays anchored. <img> not <Image>
// because logo_url is user-supplied and may point at any host (no
// allowlist on next.config.js makes Image throw).
function OrgLogo({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || '·';
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className="h-12 w-12 rounded-md object-contain bg-surface-raised border border-line"
      />
    );
  }
  return (
    <div className="h-12 w-12 rounded-md bg-surface-sunken border border-line flex items-center justify-center text-base font-medium text-ink-subtle">
      {initial}
    </div>
  );
}

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await uiLocale();

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

  const hasInvoices = await organisationHasVisibleInvoices(id);

  const orderedApps = APP_ORDER.filter(
    (slug) => appSlugs.includes(slug) && isAppSlug(slug),
  );

  const tabs = [
    { href: `/organisations/${id}`, label: t(locale, 'overview') },
    { href: `/organisations/${id}/profile`, label: t(locale, 'profile_title') },
    ...(hasInvoices ? [{ href: `/organisations/${id}/invoices`, label: t(locale, 'nav_invoices') }] : []),
    ...orderedApps
      .filter((slug) => slug !== 'fibre-platform')
      .map((slug) => ({
        href: `/organisations/${id}/app/${slug}`,
        label: APPS[slug].label,
      })),
  ];

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/organisations" label={t(locale, 'nav_organisations')} />
      <PageHeader
        title={org.name}
        description={orgAlsoKnownAs(org, locale)}
        actions={<OrgActions org={org} locale={locale} />}
        leading={<OrgLogo logoUrl={org.logo_url} name={org.name} />}
      />
      <TabNav tabs={tabs} />
      <div className="mt-8">{children}</div>
    </PageContainer>
  );
}

// "ebbf · formerly European Bahá'í Business Forum" — the header answers "is
// this the one I was thinking of?" for someone who remembers another name.
// Legal name stays in the line only when it differs from the display name.
function orgAlsoKnownAs(
  org: { name: string; legal_name: string | null; short_name: string | null; other_names: string[] | null },
  locale: Parameters<typeof t>[0],
): string | undefined {
  const parts: string[] = [];
  if (org.short_name && org.short_name !== org.name) parts.push(org.short_name);
  const others = (org.other_names ?? []).filter((n) => n && n !== org.name);
  if (others.length) parts.push(`${t(locale, 'org_also_known_as')} ${others.join(', ')}`);
  if (org.legal_name && org.legal_name !== org.name) parts.push(org.legal_name);
  return parts.length ? parts.join(' · ') : undefined;
}

/** The Invoices tab appears only when this organisation paid something the
 *  viewer may see — same rule as a contact's tab. */
async function organisationHasVisibleInvoices(orgId: string): Promise<boolean> {
  for (const scope of ['workspace', 'me'] as const) {
    try {
      const r = await apiFetch<{ totals?: { count?: number } }>(
        `/api/v1/purchases?scope=${scope}&org_id=${encodeURIComponent(orgId)}`,
      );
      return (r.totals?.count ?? 0) > 0;
    } catch (e) {
      if (e instanceof ApiError && e.status === 403 && scope === 'workspace') continue;
      return false;
    }
  }
  return false;
}
