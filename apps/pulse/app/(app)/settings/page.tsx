import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import { appName, appUrl } from '@thefibre/shared';
import { SettingsCards, platformSettings } from '@thefibre/shared/ui/settings';
import { canManageWorkspace } from '@thefibre/shared';
import { apiFetch } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { PageContainer, PageHeader } from './page-chrome';

export default async function SettingsPage() {
  const locale = await uiLocale();
  // Same question the admin-only pages ask, so the hub cannot offer a door
  // that refuses (Sjoerd, 2026-10-06). Fails closed on a failed load.
  const me = await apiFetch<{ user: { is_super_admin?: boolean }; memberships: { app: { slug: string } | { slug: string }[] | null; role: string }[] }>(
    '/api/v1/auth/me',
  ).catch(() => null);
  const sections = platformSettings({
    canManage: canManageWorkspace(me),
    locale,
    currentApp: 'fibre-pulse',
    env: process.env,
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
