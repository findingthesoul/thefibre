import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import { appName, appUrl } from '@thefibre/shared';
import { SettingsCards, platformSettings } from '@thefibre/shared/ui/settings';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { PageContainer, PageHeader } from './page-chrome';

export default async function SettingsPage() {
  const locale = await uiLocale();
  const sections = platformSettings({
    locale,
    fibreUrl: appUrl('fibre-platform', process.env),
    hosted: ['payments'],
    omit: ['connections'],
    appSection: {
      label: appName('fibre-pulse'),
      entries: [
        {
          href: '/settings/planner',
          icon: <SlidersHorizontal size={17} strokeWidth={1.75} />,
          title: t(locale, 'planner'),
          desc: t(locale, 'planner_card_desc'),
        },
      ],
    },
  });

  return (
    <PageContainer max="4xl">
      <PageHeader
        title={t(locale, 'settings')}
        description={t(locale, 'settings_page_blurb')}
      />
      <SettingsCards sections={sections} link={Link} locale={locale} />
    </PageContainer>
  );
}
