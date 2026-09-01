import Link from 'next/link';
import { appName, appUrl } from '@thefibre/shared';
import { HelpPage, type HelpSection } from '@thefibre/shared/ui/help';
import { apiFetch } from '@/lib/api';
import { buildAppList } from '@/lib/available-apps';

export const metadata = { title: `Help — ${appName('fibre-flow')}` };

type Me = { memberships: { app: { slug: string } | { slug: string }[] | null }[] };
type WorkspaceApp = {
  deactivated_at: string | null;
  app: { slug: string } | { slug: string }[] | null;
};

// Mirrors NAV in components/shell/sidebar.tsx, with the blurbs the pages
// themselves already use.
const SECTIONS: HelpSection[] = [
  { label: 'Home', href: '/dashboard', blurb: "What's moving today, and your favourite flows." },
  {
    label: 'Flows',
    href: '/flows',
    blurb:
      'State machines your contacts move through. Each step is held by gate tasks; the builder is visual.',
  },
  {
    label: 'Tasks',
    href: '/tasks',
    blurb:
      'Open tasks assigned to you across all flows. Completing the gate tasks of a step moves the run on.',
  },
  {
    label: 'Contacts',
    href: '/contacts',
    blurb: 'People currently moving through a flow. Identity comes from The Fibre.',
  },
];

export default async function FlowHelpPage() {
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
      appId="fibre-flow"
      sections={SECTIONS}
      otherApps={apps}
      aboutHref={`${appUrl('fibre-platform', process.env)}/settings/about`}
      link={Link}
    />
  );
}
