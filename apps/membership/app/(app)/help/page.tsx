import Link from 'next/link';
import { appName, appUrl } from '@thefibre/shared';
import { HelpPage, type HelpSection } from '@thefibre/shared/ui/help';
import { apiFetch } from '@/lib/api';
import { buildAppList } from '@/lib/available-apps';

export const metadata = { title: `Help · ${appName('membership')}` };

type Me = { memberships: { app: { slug: string } | { slug: string }[] | null }[] };
type WorkspaceApp = {
  deactivated_at: string | null;
  app: { slug: string } | { slug: string }[] | null;
};

// Mirrors NAV in components/shell/sidebar.tsx, with the blurbs the pages
// themselves already use.
const SECTIONS: HelpSection[] = [
  {
    label: 'Membership',
    href: '/dashboard',
    blurb: 'Your community at a glance — active members, renewals coming up, recent joins.',
  },
  {
    label: 'Members',
    href: '/members',
    blurb:
      'Everyone who holds (or held) a membership: tier, status, renewal date. Add someone manually or let the join page do it.',
  },
  {
    label: 'Tiers',
    href: '/tiers',
    blurb:
      'What you sell: yearly (and optionally monthly) prices, what each tier includes, in the order the join page shows them.',
  },
  {
    label: 'Products',
    href: '/products',
    blurb:
      'The catalogue tiers draw from — spaces, programmes, perks — each with links to the thing itself.',
  },
  {
    label: 'Access',
    href: '/access',
    blurb:
      'What each tier unlocks in the outside world (a Circle space, a thread). Grants sync automatically as members come and go.',
  },
  {
    label: 'Settings',
    href: '/settings',
    blurb: 'The join page, the Circle connection, and your Fibre profile.',
  },
];

export default async function MembershipHelpPage() {
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
      appId="membership"
      sections={SECTIONS}
      otherApps={apps}
      aboutHref={`${appUrl('fibre-platform', process.env)}/settings/about`}
      link={Link}
    />
  );
}
