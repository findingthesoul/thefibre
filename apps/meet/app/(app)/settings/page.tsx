import Link from 'next/link';
import { Globe, Clock, CalendarDays, Plug } from 'lucide-react';
import { appName, appUrl } from '@thefibre/shared';
import { SettingsCards, platformSettings } from '@thefibre/shared/ui/settings';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';

const ICON = { size: 17, strokeWidth: 1.75 } as const;

export default async function SettingsIndex() {
  const locale = await uiLocale();
  const sections = platformSettings({
    locale,
    fibreUrl: appUrl('fibre-platform', process.env),
    hosted: ['payments'],
    appSection: {
      label: appName('fibre-meet'),
      entries: [
        {
          href: '/settings/profile',
          icon: <Globe {...ICON} />,
          title: t(locale, 'st_booking_page'),
          desc: t(locale, 'st_booking_page_desc'),
        },
        {
          href: '/settings/availability',
          icon: <Clock {...ICON} />,
          title: t(locale, 'st_availability'),
          desc: t(locale, 'st_availability_desc'),
        },
        {
          href: '/settings/calendars',
          icon: <CalendarDays {...ICON} />,
          title: t(locale, 'st_calendars'),
          desc: t(locale, 'st_calendars_desc'),
        },
        {
          href: '/settings/integrations',
          icon: <Plug {...ICON} />,
          title: t(locale, 'st_integrations'),
          desc: t(locale, 'st_integrations_desc'),
        },
      ],
    },
  });

  return (
    <PageContainer max="4xl">
      <PageHeader title={t(locale, 'settings')} description={t(locale, 'settings_desc')} />
      <SettingsCards sections={sections} link={Link} locale={locale} />
    </PageContainer>
  );
}
