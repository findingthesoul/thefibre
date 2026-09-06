import Link from 'next/link';
import { HelpPage, type HelpSection } from '@thefibre/shared/ui/help';
import { apiFetch } from '@/lib/api';
import { buildAppList } from '@/lib/available-apps';
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
    { label: t(locale, 'nav_settings'), href: '/settings', blurb: t(locale, 'help_settings_blurb') },
  ];
}

export default async function WebHelpPage() {
  const locale = await uiLocale();
  let apps: { slug: string; name: string; url: string }[] = [];
  try {
    const me = await apiFetch<Me>('/api/v1/auth/me');
    const r = await apiFetch<{ items: WorkspaceApp[] }>('/api/v1/workspace-apps');
    apps = buildAppList({ currentApp: 'fibre-platform', memberships: me.memberships, workspaceApps: r.items });
  } catch {
    apps = [];
  }

  return (
    <HelpPage
      appId="fibre-platform"
      sections={sections(locale)}
      otherApps={apps}
      aboutHref="/settings/about"
      link={Link}
      locale={locale}
    />
  );
}
