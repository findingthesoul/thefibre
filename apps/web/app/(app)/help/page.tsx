import Link from 'next/link';
import { HelpPage, type HelpSection } from '@thefibre/shared/ui/help';
import { apiFetch } from '@/lib/api';
import { buildAppList } from '@/lib/available-apps';

export const metadata = { title: 'Help — The Fibre' };

type Me = { memberships: { app: { slug: string } | { slug: string }[] | null }[] };
type WorkspaceApp = {
  deactivated_at: string | null;
  app: { slug: string } | { slug: string }[] | null;
};

// Mirrors NAV in components/shell/sidebar.tsx. Blurbs are the ones the pages
// themselves already use, so Help never says something the page contradicts.
const SECTIONS: HelpSection[] = [
  {
    label: 'Home',
    href: '/dashboard',
    blurb: 'Your apps, and what has moved recently across them.',
  },
  {
    label: 'Contacts',
    href: '/contacts',
    blurb:
      'Every person the workspace knows. Identity lives here; each app that holds something about them adds its own tab to their profile.',
  },
  {
    label: 'Organisations',
    href: '/organisations',
    blurb: 'Organisations, who belongs to them, and the same per-app tabs as a person.',
  },
  {
    label: 'Programmes',
    href: '/programmes',
    blurb:
      'Events, journeys, meetings, courses. Each programme belongs to the app that delivers it.',
  },
  {
    label: 'Activity',
    href: '/activity',
    blurb:
      'The accumulated record of every meaningful interaction across every app. Add-only: a mistake is corrected by a new line, never by rewriting the old one.',
  },
  {
    label: 'Privacy',
    href: '/privacy',
    blurb: 'Your data, your consents, your rights. EU-hosted, GDPR-native.',
  },
  {
    label: 'Settings',
    href: '/settings',
    blurb: 'Your profile, your workspace, your access — and which apps are switched on.',
  },
];

export default async function WebHelpPage() {
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
      sections={SECTIONS}
      otherApps={apps}
      aboutHref="/settings/about"
      link={Link}
    />
  );
}
