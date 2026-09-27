import Link from 'next/link';
import { appName, appUrl } from '@thefibre/shared';
import { HelpPage, guideSteps, type HelpGuide, type HelpSection } from '@thefibre/shared/ui/help';
import { apiFetch } from '@/lib/api';
import { headers } from 'next/headers';
import { buildAppList } from '@thefibre/shared/available-apps';
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

// The manual — task by task, in the order a new organiser meets things
// (rhythm → bank → income → costs → moving money → invoicing → reserves →
// teams). Titles and steps come from the catalog; steps are one string per
// guide, split on newlines by guideSteps.
const GUIDES = [
  { slug: 'rhythm', href: '/settings/planner' },
  { slug: 'bank', href: '/cashflow' },
  { slug: 'income', href: '/cashflow' },
  { slug: 'budget', href: '/budget' },
  { slug: 'retime', href: '/cashflow' },
  { slug: 'invoice', href: '/cashflow' },
  { slug: 'reserve', href: '/settings/planner' },
  { slug: 'teams', href: '/teams' },
] as const;

function guides(locale: Locale): HelpGuide[] {
  return GUIDES.map(({ slug, href }) => ({
    title: t(locale, `help_g_${slug}_title`),
    steps: guideSteps(t(locale, `help_g_${slug}_steps`)),
    href,
  }));
}

export default async function PulseHelpPage() {
  const locale = await uiLocale();
  let apps: { slug: string; name: string; url: string }[] = [];
  try {
    const me = await apiFetch<Me>('/api/v1/auth/me');
    const r = await apiFetch<{ items: WorkspaceApp[] }>('/api/v1/workspace-apps');
    apps = buildAppList({
      currentApp: 'fibre-pulse',
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
      appId="fibre-pulse"
      sections={sections(locale)}
      guides={guides(locale)}
      otherApps={apps}
      aboutHref={`${appUrl('fibre-platform', process.env)}/settings/about`}
      link={Link}
      locale={locale}
    />
  );
}
