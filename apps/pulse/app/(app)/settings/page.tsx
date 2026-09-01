import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import { appName, appUrl } from '@thefibre/shared';
import { SettingsCards, platformSettings } from '@thefibre/shared/ui/settings';
import { PageContainer, PageHeader } from './page-chrome';

export default function SettingsPage() {
  const sections = platformSettings({
    fibreUrl: appUrl('fibre-platform', process.env),
    hosted: ['payments'],
    omit: ['connections'],
    appSection: {
      label: appName('fibre-pulse'),
      entries: [
        {
          href: '/settings/planner',
          icon: <SlidersHorizontal size={17} strokeWidth={1.75} />,
          title: 'Planner',
          desc: "Pulse's assumptions — rhythm, invoicing, ledger, reservations, teams, stages, offerings and history.",
        },
      ],
    },
  });

  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Settings"
        description="You, the workspace, and Pulse. The same four sections in every Fibre app."
      />
      <SettingsCards sections={sections} link={Link} />
    </PageContainer>
  );
}
