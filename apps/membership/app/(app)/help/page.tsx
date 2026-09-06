import Link from 'next/link';
import { appName, appUrl } from '@thefibre/shared';
import { HelpPage, type HelpSection } from '@thefibre/shared/ui/help';
import { apiFetch } from '@/lib/api';
import { buildAppList } from '@/lib/available-apps';
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
      href: '/products',
      blurb: t(locale, 'help_access_blurb'),
    },
    {
      label: t(locale, 'nav_settings'),
      href: '/settings',
      blurb: t(locale, 'help_settings_blurb'),
    },
  ];
}

export default async function MembershipHelpPage() {
  const locale = await uiLocale();
  let apps: { slug: string; name: string; url: string }[] = [];
  try {
    const me = await apiFetch<Me>('/api/v1/auth/me');
    const r = await apiFetch<{ items: WorkspaceApp[] }>('/api/v1/workspace-apps');
    apps = buildAppList({ currentApp: 'membership', memberships: me.memberships, workspaceApps: r.items });
  } catch {
    apps = [];
  }

  return (
    <HelpPage
      appId="membership"
      sections={sections(locale)}
      otherApps={apps}
      aboutHref={`${appUrl('fibre-platform', process.env)}/settings/about`}
      link={Link}
      locale={locale}
    />
  );
}
