import Link from 'next/link';
import { Globe, Clock, CalendarDays, Plug } from 'lucide-react';
import { appName, appUrl } from '@thefibre/shared';
import { SettingsCards, platformSettings } from '@thefibre/shared/ui/settings';
import { PageContainer, PageHeader } from '@/components/ui/page';

const ICON = { size: 17, strokeWidth: 1.75 } as const;

export default function SettingsIndex() {
  const sections = platformSettings({
    fibreUrl: appUrl('fibre-platform', process.env),
    hosted: ['payments'],
    appSection: {
      label: appName('fibre-meet'),
      entries: [
        {
          href: '/settings/profile',
          icon: <Globe {...ICON} />,
          title: 'Booking page',
          desc: 'The address people book you at, your location and your personal room.',
        },
        {
          href: '/settings/availability',
          icon: <Clock {...ICON} />,
          title: 'Availability',
          desc: 'Timezone and weekly working hours.',
        },
        {
          href: '/settings/calendars',
          icon: <CalendarDays {...ICON} />,
          title: 'Calendars',
          desc: 'Which calendars are checked for conflicts, and where bookings land.',
        },
        {
          href: '/settings/integrations',
          icon: <Plug {...ICON} />,
          title: 'Integrations',
          desc: 'Video, and the rest of what Meet can talk to.',
        },
      ],
    },
  });

  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Settings"
        description="You, the workspace, and Meet. The same four sections in every Fibre app."
      />
      <SettingsCards sections={sections} link={Link} />
    </PageContainer>
  );
}
