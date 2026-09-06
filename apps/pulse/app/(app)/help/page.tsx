import Link from 'next/link';
import { appName, appUrl } from '@thefibre/shared';
import { HelpPage, type HelpSection } from '@thefibre/shared/ui/help';
import { apiFetch } from '@/lib/api';
import { buildAppList } from '@/lib/available-apps';
import { uiLocale } from '@/lib/locale';
import { t, type Locale } from '@/lib/i18n-ui';

export const metadata = { title: `Help · ${appName('fibre-pulse')}` };

type Me = { memberships: { app: { slug: string } | { slug: string }[] | null }[] };
type WorkspaceApp = {
  deactivated_at: string | null;
  app: { slug: string } | { slug: string }[] | null;
};

// Mirrors NAV in components/shell/sidebar.tsx, with the blurbs the pages
// themselves already use.
function sections(locale: Locale): HelpSection[] {
  return [
    { label: 'Pulse', href: '/dashboard', blurb: t(locale, 'help_pulse_blurb') },
    { label: t(locale, 'nav_cashflow'), href: '/cashflow', blurb: t(locale, 'cashflow_blurb') },
    { label: t(locale, 'nav_projects'), href: '/projects', blurb: t(locale, 'projects_blurb') },
    { label: t(locale, 'nav_budget'), href: '/budget', blurb: t(locale, 'budget_blurb') },
    { label: t(locale, 'nav_teams'), href: '/teams', blurb: t(locale, 'teams_blurb') },
    { label: t(locale, 'nav_invoices'), href: '/invoices', blurb: t(locale, 'invoices_blurb') },
    { label: t(locale, 'nav_accounts'), href: '/accounts', blurb: t(locale, 'accounts_blurb') },
    { label: t(locale, 'nav_settings'), href: '/settings', blurb: t(locale, 'settings_help_blurb') },
  ];
}

export default async function PulseHelpPage() {
  const locale = await uiLocale();
  let apps: { slug: string; name: string; url: string }[] = [];
  try {
    const me = await apiFetch<Me>('/api/v1/auth/me');
    const r = await apiFetch<{ items: WorkspaceApp[] }>('/api/v1/workspace-apps');
    apps = buildAppList({ currentApp: 'fibre-pulse', memberships: me.memberships, workspaceApps: r.items });
  } catch {
    apps = [];
  }

  return (
    <HelpPage
      appId="fibre-pulse"
      sections={sections(locale)}
      otherApps={apps}
      aboutHref={`${appUrl('fibre-platform', process.env)}/settings/about`}
      link={Link}
      locale={locale}
    />
  );
}
