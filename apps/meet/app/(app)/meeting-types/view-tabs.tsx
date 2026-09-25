'use client';

// Active / Archived, as the shared tab bar in its link form. A client module
// because the page is a server component and a component (next/link) cannot be
// handed across that boundary as a prop — same arrangement as Connections'
// landscape tabs, which is where this pattern is written up.

import Link from 'next/link';
import { Tabs } from '@thefibre/shared/ui/tabs';

export function MeetingTypesViewTabs({
  view,
  labels,
}: {
  view: 'active' | 'archived';
  labels: { active: string; archived: string };
}) {
  return (
    <Tabs
      className="mt-8"
      link={Link}
      value={view}
      tabs={[
        { value: 'active', label: labels.active, href: '/meeting-types' },
        { value: 'archived', label: labels.archived, href: '/meeting-types?view=archived' },
      ]}
    />
  );
}
