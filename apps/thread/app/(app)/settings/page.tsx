import Link from 'next/link';
import { Globe, Code2, Shapes } from 'lucide-react';
import { appUrl } from '@thefibre/shared';
import { SettingsCards, platformSettings } from '@thefibre/shared/ui/settings';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';

// Same four sections, same order, same words as every other app — see
// packages/shared/src/ui/settings.tsx for why that matters.

const ICON = { size: 17, strokeWidth: 1.75 } as const;

export default async function SettingsPage() {
  const locale = await uiLocale();
  const fibre = appUrl('fibre-platform', process.env);
  const sections = platformSettings({
    locale,
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
          title: t(locale, 'settings_public_page'),
          desc: t(locale, 'settings_public_page_desc'),
        },
        {
          href: '/settings/embeds',
          icon: <Code2 {...ICON} />,
          title: t(locale, 'settings_embeds'),
          desc: t(locale, 'settings_embeds_desc'),
        },
        {
          href: '/settings/categories',
          icon: <Shapes {...ICON} />,
          title: t(locale, 'categories'),
          desc: t(locale, 'settings_categories_desc'),
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
