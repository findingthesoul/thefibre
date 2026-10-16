'use client';

// The You page's tab bar: the shared Tabs in LINK mode, so each tab is a
// deep link (/you?tab=…) that works before JavaScript and can be shared.
// A client wrapper because the shared bar takes the app's link component as
// a prop, and a server page cannot hand a component across that boundary.

import Link from 'next/link';
import { Tabs } from '@thefibre/shared/ui/tabs';

export const YOU_TABS = ['profile', 'memberships', 'billing', 'notifications', 'privacy'] as const;
export type YouTab = (typeof YOU_TABS)[number];

const LABELS: Record<YouTab, string> = {
  profile: 'Profile',
  memberships: 'Memberships & purchases',
  billing: 'Billing',
  notifications: 'Notifications',
  privacy: 'Privacy',
};

export function YouTabs({ value }: { value: YouTab }) {
  return (
    <Tabs
      className="mt-6"
      link={Link}
      value={value}
      tabs={YOU_TABS.map((t) => ({ value: t, label: LABELS[t], href: t === 'profile' ? '/you' : `/you?tab=${t}` }))}
    />
  );
}
