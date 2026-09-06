import Link from 'next/link';
import { appName, appUrl } from '@thefibre/shared';
import { HelpPage, type HelpSection } from '@thefibre/shared/ui/help';
import { apiFetch } from '@/lib/api';
import { buildAppList } from '@/lib/available-apps';

export const metadata = { title: `Help — ${appName('fibre-meet')}` };

type Me = { memberships: { app: { slug: string } | { slug: string }[] | null }[] };
type WorkspaceApp = {
  deactivated_at: string | null;
  app: { slug: string } | { slug: string }[] | null;
};

// Mirrors NAV in components/shell/sidebar.tsx, with the blurbs the pages
// themselves already use.
const SECTIONS: HelpSection[] = [
  { label: 'Home', href: '/dashboard', blurb: 'Today, and what is booked next.' },
  {
    label: 'Meeting types',
    href: '/meeting-types',
    blurb: 'What you offer to be booked for — length, availability, price, where it happens.',
  },
  {
    label: 'Teams',
    href: '/teams',
    blurb: 'Shared groups that own their own booking links and meeting types.',
  },
  { label: 'Bookings', href: '/bookings', blurb: 'Everything booked with you.' },
  {
    label: 'Invoices',
    href: '/invoices',
    blurb: 'Every purchase across your Fibre apps — search, resend invoices, reimburse.',
  },
  {
    label: 'Contacts',
    href: '/contacts',
    blurb:
      'People Meet has a reason to know about — invitees on bookings, and members of your Meet teams. Identity is managed in The Fibre platform.',
  },
  {
    label: 'Internal team',
    href: '/internal-team',
    blurb:
      "Workspace members who can sign in to Meet. External collaborators don't live here — add them per team.",
  },
  {
    label: 'Settings',
    href: '/settings',
    blurb: 'Personal and workspace configuration — calendar connection, payments, defaults.',
  },
];

export default async function MeetHelpPage() {
  let apps: { slug: string; name: string; url: string }[] = [];
  try {
    const me = await apiFetch<Me>('/api/v1/auth/me');
    const r = await apiFetch<{ items: WorkspaceApp[] }>('/api/v1/workspace-apps');
    apps = buildAppList({ currentApp: 'fibre-meet', memberships: me.memberships, workspaceApps: r.items });
  } catch {
    apps = [];
  }

  return (
    <HelpPage
      appId="fibre-meet"
      sections={SECTIONS}
      otherApps={apps}
      aboutHref={`${appUrl('fibre-platform', process.env)}/settings/about`}
      link={Link}
    />
  );
}
