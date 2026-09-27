import Link from 'next/link';
import { headers } from 'next/headers';
import { HelpPage, guideSteps, type HelpGuide, type HelpSection } from '@thefibre/shared/ui/help';
import { apiFetch } from '@/lib/api';
import { buildAppList } from '@thefibre/shared/available-apps';
import { uiLocale } from '@/lib/locale';
import { t, type Locale } from '@/lib/i18n-ui';

export const metadata = { title: 'Help — The Fibre' };

type Me = { memberships: { app: { slug: string } | { slug: string }[] | null }[] };
type WorkspaceApp = {
  deactivated_at: string | null;
  app: { slug: string } | { slug: string }[] | null;
};

// Mirrors NAV in components/shell/sidebar.tsx. Blurbs are the ones the pages
// themselves already use, so Help never says something the page contradicts.
function sections(locale: Locale): HelpSection[] {
  return [
    { label: t(locale, 'nav_home'), href: '/dashboard', blurb: t(locale, 'help_home_blurb') },
    { label: t(locale, 'nav_contacts'), href: '/contacts', blurb: t(locale, 'help_contacts_blurb') },
    {
      label: t(locale, 'nav_organisations'),
      href: '/organisations',
      blurb: t(locale, 'help_organisations_blurb'),
    },
    {
      label: t(locale, 'nav_programmes'),
      href: '/programmes',
      blurb: t(locale, 'help_programmes_blurb'),
    },
    { label: t(locale, 'nav_activity'), href: '/activity', blurb: t(locale, 'help_activity_blurb') },
    { label: t(locale, 'nav_privacy'), href: '/privacy', blurb: t(locale, 'privacy_blurb') },
    { label: t(locale, 'nav_settings'), href: '/settings', blurb: t(locale, 'help_settings_blurb_full') },
  ];
}

// The manual (2026-09-27): task by task, in the order a new organiser meets
// things — people and organisations first, then who may do what, then money,
// then the connected assistant, then the rarer questions. Each pair of keys
// lives at the end of lib/i18n-ui.ts under "help: how-to guides"; the steps
// are one string split on newlines. Every button named exists on the page
// the guide links to — check the screen before editing a step.
const GUIDES = [
  { slug: 'add_person', href: '/contacts/new' },
  { slug: 'duplicates', href: '/contacts/duplicates' },
  { slug: 'org_domain', href: '/organisations' },
  { slug: 'members', href: '/settings/members' },
  { slug: 'apps', href: '/settings/apps' },
  { slug: 'plan', href: '/settings/plan' },
  { slug: 'payments', href: '/settings/payments' },
  { slug: 'own_claude', href: '/settings/assistant' },
  { slug: 'switch_workspace', href: '/dashboard' },
  { slug: 'privacy', href: '/privacy' },
] as const;

function guides(locale: Locale): HelpGuide[] {
  return GUIDES.map(({ slug, href }) => ({
    title: t(locale, `help_g_${slug}_title`),
    steps: guideSteps(t(locale, `help_g_${slug}_steps`)),
    href,
  }));
}

export default async function WebHelpPage() {
  const locale = await uiLocale();
  let apps: { slug: string; name: string; url: string }[] = [];
  try {
    const me = await apiFetch<Me>('/api/v1/auth/me');
    const r = await apiFetch<{ items: WorkspaceApp[] }>('/api/v1/workspace-apps');
    apps = buildAppList({
      currentApp: 'fibre-platform',
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
      appId="fibre-platform"
      sections={sections(locale)}
      guides={guides(locale)}
      otherApps={apps}
      aboutHref="/settings/about"
      link={Link}
      locale={locale}
    />
  );
}
