'use client';

// The You page's tab bar: the shared Tabs in LINK mode, so each tab is a
// deep link (/you?tab=…) that works before JavaScript and can be shared.
// A client wrapper because the shared bar takes the app's link component as
// a prop, and a server page cannot hand a component across that boundary.

import Link from 'next/link';
import { Tabs } from '@thefibre/shared/ui/tabs';
import { YOU_TABS, type YouTab } from './tabs';
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import { t, type MyKey } from '@/lib/i18n';

const LABELS: Record<YouTab, MyKey> = {
  profile: 'tab_profile',
  memberships: 'tab_memberships',
  billing: 'tab_billing',
  notifications: 'notifications',
  privacy: 'tab_privacy',
};

export function YouTabs({ value }: { value: YouTab }) {
  const locale = useLocale();
  return (
    <Tabs
      className="mt-6"
      link={Link}
      value={value}
      tabs={YOU_TABS.map((tab) => ({ value: tab, label: t(locale, LABELS[tab]), href: tab === 'profile' ? '/you' : `/you?tab=${tab}` }))}
    />
  );
}
