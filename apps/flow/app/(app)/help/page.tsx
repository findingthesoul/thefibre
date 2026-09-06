import Link from 'next/link';
import { appName, appUrl } from '@thefibre/shared';
import { HelpPage, type HelpSection } from '@thefibre/shared/ui/help';
import { apiFetch } from '@/lib/api';
import { buildAppList } from '@/lib/available-apps';
import { uiLocale } from '@/lib/locale';
import { t, type Locale } from '@/lib/i18n-ui';

export const metadata = { title: `Help — ${appName('fibre-flow')}` };

type Me = { memberships: { app: { slug: string } | { slug: string }[] | null }[] };
type WorkspaceApp = {
  deactivated_at: string | null;
  app: { slug: string } | { slug: string }[] | null;
};

// Mirrors NAV in components/shell/sidebar.tsx, with the blurbs the pages
// themselves already use.
function sections(locale: Locale): HelpSection[] {
  return [
    { label: t(locale, 'nav_home'), href: '/dashboard', blurb: t(locale, 'help_home_blurb') },
    { label: t(locale, 'flows'), href: '/flows', blurb: t(locale, 'help_flows_blurb') },
    { label: t(locale, 'nav_tasks'), href: '/tasks', blurb: t(locale, 'help_tasks_blurb') },
    { label: t(locale, 'nav_contacts'), href: '/contacts', blurb: t(locale, 'help_contacts_blurb') },
  ];
}

export default async function FlowHelpPage() {
  const locale = await uiLocale();
  let apps: { slug: string; name: string; url: string }[] = [];
  try {
    const me = await apiFetch<Me>('/api/v1/auth/me');
    const r = await apiFetch<{ items: WorkspaceApp[] }>('/api/v1/workspace-apps');
    apps = buildAppList({ currentApp: 'fibre-flow', memberships: me.memberships, workspaceApps: r.items });
  } catch {
    apps = [];
  }

  return (
    <HelpPage
      appId="fibre-flow"
      sections={sections(locale)}
      otherApps={apps}
      aboutHref={`${appUrl('fibre-platform', process.env)}/settings/about`}
      link={Link}
      locale={locale}
    />
  );
}
