import Link from 'next/link';
import { appName, appUrl } from '@thefibre/shared';
import { HelpPage, type HelpSection } from '@thefibre/shared/ui/help';
import { apiFetch } from '@/lib/api';
import { buildAppList } from '@/lib/available-apps';

export const metadata = { title: `Help · ${appName('fibre-pulse')}` };

type Me = { memberships: { app: { slug: string } | { slug: string }[] | null }[] };
type WorkspaceApp = {
  deactivated_at: string | null;
  app: { slug: string } | { slug: string }[] | null;
};

// Mirrors NAV in components/shell/sidebar.tsx, with the blurbs the pages
// themselves already use.
const SECTIONS: HelpSection[] = [
  { label: 'Pulse', href: '/dashboard', blurb: 'Runway at a glance, and the dips ahead of it.' },
  {
    label: 'Cashflow',
    href: '/cashflow',
    blurb:
      'Expected money in and out, per contact — every line weighted by where it stands in the pipeline (a Flow).',
  },
  {
    label: 'Projects',
    href: '/projects',
    blurb:
      'Projects run under your involved teams (hubs/incubators) or free-standing.',
  },
  {
    label: 'Budget',
    href: '/budget',
    blurb:
      'Recurring lines expand into the projection automatically. Toggled-off lines stay here, out of the numbers.',
  },
  {
    label: 'Teams',
    href: '/teams',
    blurb:
      'Teams are a Fibre platform primitive — one team, every app. Toggle which ones take part in the planner.',
  },
  {
    label: 'Invoices',
    href: '/invoices',
    blurb: 'Every purchase across your Fibre apps — search, resend invoices, reimburse.',
  },
  {
    label: 'Accounts',
    href: '/accounts',
    blurb:
      'Balance snapshots anchor the projection. Reserves are earmarked money — in the bank, not yours to spend.',
  },
  {
    label: 'Settings',
    href: '/settings',
    blurb: "Your Fibre profile, payments and the planner's assumptions.",
  },
];

export default async function PulseHelpPage() {
  let apps: { slug: string; name: string; url: string }[] = [];
  try {
    const me = await apiFetch<Me>('/api/v1/auth/me');
    const r = await apiFetch<{ items: WorkspaceApp[] }>('/api/v1/workspace-apps');
    apps = buildAppList({ memberships: me.memberships, workspaceApps: r.items });
  } catch {
    apps = [];
  }

  return (
    <HelpPage
      appId="fibre-pulse"
      sections={SECTIONS}
      otherApps={apps}
      aboutHref={`${appUrl('fibre-platform', process.env)}/settings/about`}
      link={Link}
    />
  );
}
