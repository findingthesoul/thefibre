import Link from 'next/link';
import { appName, appUrl } from '@thefibre/shared';
import { HelpPage, guideSteps, type HelpGuide, type HelpSection } from '@thefibre/shared/ui/help';
import { apiFetch } from '@/lib/api';
import { headers } from 'next/headers';
import { buildAppList } from '@thefibre/shared/available-apps';
import { uiLocale } from '@/lib/locale';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';

export const metadata = { title: `Help — ${appName('fibre-flow')}` };

type Me = { memberships: { app: { slug: string } | { slug: string }[] | null }[] };
type WorkspaceApp = {
  deactivated_at: string | null;
  app: { slug: string } | { slug: string }[] | null;
};

// Mirrors NAV in components/shell/sidebar.tsx. The blurbs say what Flow is
// now (2026-09-23, Sjoerd): the engine underneath the other apps rather than
// a tool you pick — Pulse pipelines and Connect follow-ups run on it. The
// screens here still exist and the guides below still walk them.
function sections(locale: Locale): HelpSection[] {
  return [
    { label: t(locale, 'nav_home'), href: '/dashboard', blurb: t(locale, 'help_home_blurb') },
    { label: t(locale, 'flows'), href: '/flows', blurb: t(locale, 'help_flows_blurb_2') },
    { label: t(locale, 'nav_tasks'), href: '/tasks', blurb: t(locale, 'help_tasks_blurb_2') },
    { label: t(locale, 'nav_contacts'), href: '/contacts', blurb: t(locale, 'help_contacts_blurb_2') },
  ];
}

// The manual (2026-09-27): one guide per task a first-time organiser meets,
// in the order they meet them. Steps live in the catalog as one string per
// guide; `href` is where the task starts. Keys are written out in full so a
// missing catalog entry is a typecheck error, not a blank guide.
function guides(locale: Locale): HelpGuide[] {
  const g = (title: UiKey, steps: UiKey, href: string): HelpGuide => ({
    title: t(locale, title),
    steps: guideSteps(t(locale, steps)),
    href,
  });
  return [
    g('help_g_create_title', 'help_g_create_steps', '/flows'),
    g('help_g_build_title', 'help_g_build_steps', '/flows'),
    g('help_g_gates_title', 'help_g_gates_steps', '/flows'),
    g('help_g_contacts_title', 'help_g_contacts_steps', '/flows'),
    g('help_g_tasks_title', 'help_g_tasks_steps', '/tasks'),
    g('help_g_lifecycle_title', 'help_g_lifecycle_steps', '/flows'),
  ];
}

export default async function FlowHelpPage() {
  const locale = await uiLocale();
  let apps: { slug: string; name: string; url: string }[] = [];
  try {
    const me = await apiFetch<Me>('/api/v1/auth/me');
    const r = await apiFetch<{ items: WorkspaceApp[] }>('/api/v1/workspace-apps');
    apps = buildAppList({
      currentApp: 'fibre-flow',
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
      appId="fibre-flow"
      sections={sections(locale)}
      guides={guides(locale)}
      otherApps={apps}
      aboutHref={`${appUrl('fibre-platform', process.env)}/settings/about`}
      link={Link}
      locale={locale}
    />
  );
}
