import Link from 'next/link';
import { headers } from 'next/headers';
import { appUrl } from '@thefibre/shared';
import { HelpPage, guideSteps, type HelpGuide, type HelpSection } from '@thefibre/shared/ui/help';
import { apiFetch } from '@/lib/api';
import { buildAppList } from '@thefibre/shared/available-apps';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import type { Locale } from '@thefibre/shared';

export const metadata = { title: 'Help — Thread' };

type Me = { memberships: { app: { slug: string } | { slug: string }[] | null }[] };
type WorkspaceApp = {
  deactivated_at: string | null;
  app: { slug: string } | { slug: string }[] | null;
};

// Mirrors NAV in components/shell/sidebar.tsx, with the blurbs the pages
// themselves already use. Check-in joined the sidebar (third, so it lands in
// the phone's tab bar) and was missing here until 2026-09-27.
function sections(locale: Locale): HelpSection[] {
  return [
    { label: t(locale, 'help_home'), href: '/dashboard', blurb: t(locale, 'help_home_blurb') },
    { label: t(locale, 'threads'), href: '/threads', blurb: t(locale, 'threads_desc') },
    { label: t(locale, 'enrolments'), href: '/enrolments', blurb: t(locale, 'enrolments_desc') },
    { label: t(locale, 'nav_checkin'), href: '/checkin', blurb: t(locale, 'checkin_any_desc') },
    { label: t(locale, 'templates'), href: '/templates', blurb: t(locale, 'templates_desc') },
    { label: t(locale, 'contacts'), href: '/contacts', blurb: t(locale, 'contacts_desc') },
    { label: t(locale, 'teams'), href: '/teams', blurb: t(locale, 'teams_desc') },
    { label: t(locale, 'invoices'), href: '/invoices', blurb: t(locale, 'invoices_desc') },
    {
      label: t(locale, 'internal_team'),
      href: '/internal-team',
      blurb: t(locale, 'internal_team_desc'),
    },
    { label: t(locale, 'settings'), href: '/settings', blurb: t(locale, 'help_settings_blurb') },
  ];
}

// The manual — task by task, in the order a new organiser meets things:
// set-up → daily use → money → advanced. Every string comes from the catalog
// (help_g_* at its end); the steps are one string split on newlines. The slug
// list is `as const` so the template-literal keys stay literal and a missing
// catalog entry is a typecheck error, not a runtime blank.
const GUIDES = [
  ['create', '/threads/new'],
  ['timeline', '/threads'],
  ['publish', '/threads'],
  ['registrations', '/enrolments'],
  ['checkin', '/checkin'],
  ['tickets', '/settings/payments'],
  ['certificates', '/certificates'],
  ['schedule', '/threads'],
  ['todo', '/templates/todos'],
  ['website', '/settings/embeds'],
] as const;

function guides(locale: Locale): HelpGuide[] {
  return GUIDES.map(([slug, href]) => ({
    title: t(locale, `help_g_${slug}_title`),
    steps: guideSteps(t(locale, `help_g_${slug}_steps`)),
    href,
  }));
}

export default async function ThreadHelpPage() {
  const locale = await uiLocale();
  let apps: { slug: string; name: string; url: string }[] = [];
  try {
    const me = await apiFetch<Me>('/api/v1/auth/me');
    const r = await apiFetch<{ items: WorkspaceApp[] }>('/api/v1/workspace-apps');
    apps = buildAppList({
      currentApp: 'the-thread',
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
      appId="the-thread"
      sections={sections(locale)}
      guides={guides(locale)}
      otherApps={apps}
      aboutHref={`${appUrl('fibre-platform', process.env)}/settings/about`}
      link={Link}
      locale={locale}
    />
  );
}
