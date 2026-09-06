import Link from 'next/link';
import { appUrl } from '@thefibre/shared';
import { HelpPage, type HelpSection } from '@thefibre/shared/ui/help';
import { apiFetch } from '@/lib/api';
import { buildAppList } from '@/lib/available-apps';

export const metadata = { title: 'Help — Thread' };

type Me = { memberships: { app: { slug: string } | { slug: string }[] | null }[] };
type WorkspaceApp = {
  deactivated_at: string | null;
  app: { slug: string } | { slug: string }[] | null;
};

// Mirrors NAV in components/shell/sidebar.tsx, with the blurbs the pages
// themselves already use.
const SECTIONS: HelpSection[] = [
  { label: 'Home', href: '/dashboard', blurb: 'What is running, and what needs you.' },
  {
    label: 'Threads',
    href: '/threads',
    blurb:
      'Events and journeys — each thread carries its own engagements, enrolments and certificate.',
  },
  { label: 'Enrolments', href: '/enrolments', blurb: 'Everyone enrolled across your threads.' },
  {
    label: 'Invoices',
    href: '/invoices',
    blurb: 'Every purchase across your Fibre apps — search, resend invoices, reimburse.',
  },
  {
    label: 'Templates',
    href: '/templates',
    blurb: 'Reusable designs — for whole threads and for certificates.',
  },
  {
    label: 'Contacts',
    href: '/contacts',
    blurb: 'The people Thread knows — everyone who has enrolled in one of your threads.',
  },
  {
    label: 'Teams',
    href: '/teams',
    blurb:
      "Shared groups that organise threads together — members see and share each other's work.",
  },
  {
    label: 'Internal team',
    href: '/internal-team',
    blurb: 'Who in the workspace can use Thread — read-only here.',
  },
  {
    label: 'Settings',
    href: '/settings',
    blurb:
      'Your organiser profile and workspace defaults — emails, payments, website embeds.',
  },
];

export default async function ThreadHelpPage() {
  let apps: { slug: string; name: string; url: string }[] = [];
  try {
    const me = await apiFetch<Me>('/api/v1/auth/me');
    const r = await apiFetch<{ items: WorkspaceApp[] }>('/api/v1/workspace-apps');
    apps = buildAppList({ currentApp: 'the-thread', memberships: me.memberships, workspaceApps: r.items });
  } catch {
    apps = [];
  }

  return (
    <HelpPage
      appId="the-thread"
      sections={SECTIONS}
      otherApps={apps}
      aboutHref={`${appUrl('fibre-platform', process.env)}/settings/about`}
      link={Link}
    />
  );
}
