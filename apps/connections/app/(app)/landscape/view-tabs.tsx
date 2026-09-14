'use client';

// Browse / Movement, as the shared tab bar in its link form. A client module
// because the page is a server component and a component (next/link) cannot be
// handed across that boundary as a prop.

import Link from 'next/link';
import { Tabs } from '@thefibre/shared/ui/tabs';

export function LandscapeViewTabs({
  view,
  axis,
  labels,
}: {
  view: 'browse' | 'movement';
  axis: string;
  labels: { browse: string; movement: string };
}) {
  return (
    <Tabs
      className="mt-6"
      link={Link}
      value={view}
      tabs={[
        { value: 'browse', label: labels.browse, href: `?view=browse&axis=${axis}` },
        { value: 'movement', label: labels.movement, href: `?view=movement&axis=${axis}` },
      ]}
    />
  );
}
