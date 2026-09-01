import Link from 'next/link';
import { Globe, Code2, Shapes } from 'lucide-react';
import { appUrl } from '@thefibre/shared';
import { SettingsCards, platformSettings } from '@thefibre/shared/ui/settings';
import { PageContainer, PageHeader } from '@/components/ui/page';

// Same four sections, same order, same words as every other app — see
// packages/shared/src/ui/settings.tsx for why that matters.

const ICON = { size: 17, strokeWidth: 1.75 } as const;

export default function SettingsPage() {
  const fibre = appUrl('fibre-platform', process.env);
  const sections = platformSettings({
    fibreUrl: fibre,
    // The Thread serves your payments and your connections; everything else
    // about you and the workspace is edited once, in The Fibre.
    hosted: ['payments', 'connections'],
    appSection: {
      label: 'Thread',
      entries: [
        {
          href: '/settings/profile',
          icon: <Globe {...ICON} />,
          title: 'Public page',
          desc: 'The address your organiser page lives at, and what it shows.',
        },
        {
          href: '/settings/embeds',
          icon: <Code2 {...ICON} />,
          title: 'Website embeds',
          desc: 'Copy-paste snippets to show your threads and take enrolments on any website.',
        },
        {
          href: '/settings/categories',
          icon: <Shapes {...ICON} />,
          title: 'Categories',
          desc: 'The labels threads can be filed under, workspace-wide or your own.',
        },
      ],
    },
  });

  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Settings"
        description="You, the workspace, and Thread. The same four sections in every Fibre app."
      />
      <SettingsCards sections={sections} link={Link} />
    </PageContainer>
  );
}
