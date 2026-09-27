import Link from 'next/link';
import { appName, appUrl } from '@thefibre/shared';
import { HelpPage, guideSteps, type HelpGuide, type HelpSection } from '@thefibre/shared/ui/help';
import { apiFetch } from '@/lib/api';
import { headers } from 'next/headers';
import { buildAppList } from '@thefibre/shared/available-apps';
import { uiLocale } from '@/lib/locale';
import { t, type Locale } from '@/lib/i18n-ui';

export const metadata = { title: `Help · ${appName('membership')}` };

type Me = { memberships: { app: { slug: string } | { slug: string }[] | null }[] };
type WorkspaceApp = {
  deactivated_at: string | null;
  app: { slug: string } | { slug: string }[] | null;
};

// Mirrors NAV in components/shell/sidebar.tsx, with the blurbs the pages
// themselves already use.
function sections(locale: Locale): HelpSection[] {
  return [
    {
      label: t(locale, 'nav_membership'),
      href: '/dashboard',
      blurb: t(locale, 'help_dash_blurb'),
    },
    {
      label: t(locale, 'nav_members'),
      href: '/members',
      blurb: t(locale, 'help_members_blurb'),
    },
    {
      label: t(locale, 'nav_tiers'),
      href: '/tiers',
      blurb: t(locale, 'help_tiers_blurb'),
    },
    {
      label: t(locale, 'nav_products'),
      href: '/products',
      blurb: t(locale, 'help_products_blurb'),
    },
    {
      label: t(locale, 'help_access_label'),
      // Access has its own page, and the `access` guide below already
      // points there; this row pointed at /products (2026-09-27 audit).
      href: '/access',
      blurb: t(locale, 'help_access_blurb'),
    },
    {
      label: t(locale, 'nav_invoices'),
      href: '/invoices',
      blurb: t(locale, 'invoices_desc'),
    },
    {
      label: t(locale, 'nav_settings'),
      href: '/settings',
      blurb: t(locale, 'help_settings_blurb_2'),
    },
  ];
}

// The manual (2026-09-27): task-by-task, in the order a new organiser meets
// things — set-up, daily use, money, the website. Titles and steps live in
// the catalog under `help_g_*`; steps are one string split on newlines.
// `as const` so a slug with no catalog entry fails typecheck instead of
// rendering its key (the cast that hid a missing st_* key on 2026-09-15).
const GUIDES = [
  { slug: 'tier', href: '/tiers' },
  { slug: 'product', href: '/products' },
  { slug: 'integrations', href: '/settings/integrations' },
  { slug: 'join', href: '/settings/join-page' },
  { slug: 'add_member', href: '/members' },
  { slug: 'manage_member', href: '/members' },
  { slug: 'access', href: '/access' },
  { slug: 'invoices', href: '/invoices' },
  { slug: 'pricing', href: '/settings/pricing' },
  { slug: 'embeds', href: '/settings/embeds' },
] as const;

function guides(locale: Locale): HelpGuide[] {
  return GUIDES.map(({ slug, href }) => ({
    title: t(locale, `help_g_${slug}_title`),
    steps: guideSteps(t(locale, `help_g_${slug}_steps`)),
    href,
  }));
}

export default async function MembershipHelpPage() {
  const locale = await uiLocale();
  let apps: { slug: string; name: string; url: string }[] = [];
  try {
    const me = await apiFetch<Me>('/api/v1/auth/me');
    const r = await apiFetch<{ items: WorkspaceApp[] }>('/api/v1/workspace-apps');
    apps = buildAppList({
      currentApp: 'membership',
      memberships: me.memberships,
      workspaceApps: r.items,
      env: process.env,
      host: (await headers()).get('host'),
    });
  } catch {
    apps = [];
  }

  return (
    <HelpPage
      appId="membership"
      sections={sections(locale)}
      guides={guides(locale)}
      otherApps={apps}
      aboutHref={`${appUrl('fibre-platform', process.env)}/settings/about`}
      link={Link}
      locale={locale}
    />
  );
}
