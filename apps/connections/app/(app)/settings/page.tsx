import Link from 'next/link';
import { Tags, Sparkles, Timer } from 'lucide-react';
import { appName } from '@thefibre/shared';
import { SettingsCards, platformSettings } from '@thefibre/shared/ui/settings';
import { PageContainer, PageHeader } from '@thefibre/shared/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';

// Connections' settings hub. The platform entries are the shared ones every
// app shows — profile, plan, members, apps — and the app section holds the
// one thing that is Connections': what this workspace calls its bands.
//
// `omit: ['connections']` refers to the PLATFORM setting of that name, which
// is the Google/calendar connection screen in Fibre. Unrelated to this app
// despite the collision, and omitted for the same reason Pulse omits it.
export default async function SettingsPage() {
  const locale = await uiLocale();
  const sections = platformSettings({
    locale,
    currentApp: 'fibre-sales',
    env: process.env,
    omit: ['connections'],
    appSection: {
      label: appName('fibre-sales'),
      entries: [
        {
          href: '/settings/hygiene',
          icon: <Sparkles size={17} strokeWidth={1.75} />,
          title: t(locale, 'hyg_card_title'),
          desc: t(locale, 'hyg_card_desc'),
        },
        {
          href: '/settings/effort',
          icon: <Timer size={17} strokeWidth={1.75} />,
          title: t(locale, 'effort_card_title'),
          desc: t(locale, 'effort_card_desc'),
        },
        {
          href: '/settings/names',
          icon: <Tags size={17} strokeWidth={1.75} />,
          title: t(locale, 'names_card_title'),
          desc: t(locale, 'names_card_desc'),
        },
      ],
    },
  });

  return (
    <PageContainer>
      <PageHeader title={t(locale, 'settings')} />
      <SettingsCards sections={sections} link={Link} locale={locale} />
    </PageContainer>
  );
}
