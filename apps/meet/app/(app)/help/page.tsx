import Link from 'next/link';
import { headers } from 'next/headers';
import { appName, appUrl } from '@thefibre/shared';
import { HelpPage, guideSteps, type HelpGuide, type HelpSection } from '@thefibre/shared/ui/help';
import { apiFetch } from '@/lib/api';
import { buildAppList } from '@thefibre/shared/available-apps';
import { uiLocale } from '@/lib/locale';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';

export const metadata = { title: `Help — ${appName('fibre-meet')}` };

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
    {
      label: t(locale, 'mt_title'),
      href: '/meeting-types',
      blurb: t(locale, 'help_mt_blurb'),
    },
    {
      label: t(locale, 'teams_title'),
      href: '/teams',
      blurb: t(locale, 'teams_desc'),
    },
    { label: t(locale, 'bookings_title'), href: '/bookings', blurb: t(locale, 'bookings_desc') },
    {
      label: t(locale, 'invoices_title'),
      href: '/invoices',
      blurb: t(locale, 'invoices_desc'),
    },
    {
      label: t(locale, 'contacts_title'),
      href: '/contacts',
      blurb: t(locale, 'help_contacts_blurb'),
    },
    {
      label: t(locale, 'it_title'),
      href: '/internal-team',
      blurb: t(locale, 'it_desc'),
    },
    {
      label: t(locale, 'settings'),
      href: '/settings',
      blurb: t(locale, 'help_settings_blurb'),
    },
  ];
}

// The manual (2026-09-27): task-by-task, in the order a new host meets
// things — page + hours, calendar, first meeting type, where it happens,
// money, vetting, daily bookings, teams, polls, retiring. Every string comes
// from the catalog; the steps are one string split on newlines.
const GUIDES = [
  { slug: 'booking_page', href: '/settings/profile' },
  { slug: 'google_calendar', href: '/settings/integrations' },
  { slug: 'create_mt', href: '/meeting-types/new' },
  { slug: 'where', href: '/settings/integrations' },
  { slug: 'charge', href: '/settings/payments' },
  { slug: 'intake_approval', href: '/meeting-types' },
  { slug: 'bookings', href: '/bookings' },
  { slug: 'team', href: '/teams' },
  { slug: 'poll', href: '/meeting-types/new' },
  { slug: 'retire', href: '/meeting-types' },
] as const;

function guides(locale: Locale): HelpGuide[] {
  return GUIDES.map(({ slug, href }) => {
    // Typed, not cast: a slug without both catalog keys fails typecheck here
    // instead of crashing the page at runtime.
    const titleKey: UiKey = `help_g_${slug}_title`;
    const stepsKey: UiKey = `help_g_${slug}_steps`;
    return { title: t(locale, titleKey), steps: guideSteps(t(locale, stepsKey)), href };
  });
}

export default async function MeetHelpPage() {
  const locale = await uiLocale();
  let apps: { slug: string; name: string; url: string }[] = [];
  try {
    const me = await apiFetch<Me>('/api/v1/auth/me');
    const r = await apiFetch<{ items: WorkspaceApp[] }>('/api/v1/workspace-apps');
    apps = buildAppList({
      currentApp: 'fibre-meet',
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
      appId="fibre-meet"
      sections={sections(locale)}
      guides={guides(locale)}
      otherApps={apps}
      aboutHref={`${appUrl('fibre-platform', process.env)}/settings/about`}
      link={Link}
      locale={locale}
    />
  );
}
