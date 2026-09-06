import Link from 'next/link';
import { Globe, Plug, Code2, Percent } from 'lucide-react';
import { appUrl } from '@thefibre/shared';
import { SettingsCards, platformSettings } from '@thefibre/shared/ui/settings';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { PageContainer, PageHeader } from './page-chrome';

// Same four sections, same order, same words as every other app — see
// packages/shared/src/ui/settings.tsx for why that matters. (Sjoerd,
// 2026-09-05: "why does it have to be different… please use one way of
// working" — this page started as bespoke cards and got the Thread shape.)

const ICON = { size: 17, strokeWidth: 1.75 } as const;

export default async function SettingsPage() {
  const locale = await uiLocale();
  const fibre = appUrl('fibre-platform', process.env);
  const sections = platformSettings({
    locale,
    fibreUrl: fibre,
    // Membership serves your payments (the Stripe account subscriptions
    // charge on); everything else about you and the workspace is edited
    // once, in The Fibre.
    hosted: ['payments'],
    appSection: {
      label: t(locale, 'nav_membership'),
      entries: [
        {
          href: '/settings/join-page',
          icon: <Globe {...ICON} />,
          title: t(locale, 'st_join_title'),
          desc: t(locale, 'st_join_desc'),
        },
        {
          href: '/settings/integrations',
          icon: <Plug {...ICON} />,
          title: t(locale, 'st_integrations_title'),
          desc: t(locale, 'st_integrations_desc'),
        },
        {
          href: '/settings/pricing',
          icon: <Percent {...ICON} />,
          title: t(locale, 'st_pricing_title'),
          desc: t(locale, 'st_pricing_desc'),
        },
        {
          href: '/settings/embeds',
          icon: <Code2 {...ICON} />,
          title: t(locale, 'st_embeds_title'),
          desc: t(locale, 'st_embeds_desc'),
        },
      ],
    },
  });

  return (
    <PageContainer max="4xl">
      <PageHeader title={t(locale, 'nav_settings')} description={t(locale, 'settings_blurb')} />
      <div className="mt-8">
        <SettingsCards sections={sections} link={Link} locale={locale} />
      </div>
    </PageContainer>
  );
}
