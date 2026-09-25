import Link from 'next/link';
import { headers } from 'next/headers';
import { appName, appUrl } from '@thefibre/shared';
import { HelpPage, type HelpSection } from '@thefibre/shared/ui/help';
import { apiFetch } from '@/lib/api';
import { buildAppList } from '@thefibre/shared/available-apps';
import { uiLocale } from '@/lib/locale';
import { t, type Locale } from '@/lib/i18n-ui';

export const metadata = { title: `Help — ${appName('fibre-models')}` };

type Me = { memberships: { app: { slug: string } | { slug: string }[] | null }[] };
type WorkspaceApp = { deactivated_at: string | null; app: { slug: string } | { slug: string }[] | null };

function sections(locale: Locale): HelpSection[] {
  return [{ label: t(locale, 'nav_models'), href: '/dashboard', blurb: t(locale, 'help_home_blurb') }];
}

export default async function ModelsHelpPage() {
  const locale = await uiLocale();
  let apps: { slug: string; name: string; url: string }[] = [];
  try {
    const me = await apiFetch<Me>('/api/v1/auth/me');
    const r = await apiFetch<{ items: WorkspaceApp[] }>('/api/v1/workspace-apps');
    apps = buildAppList({ currentApp: 'fibre-models', memberships: me.memberships, workspaceApps: r.items, env: process.env, host: (await headers()).get('host') });
  } catch {
    apps = [];
  }
  return (
    <HelpPage
      appId="fibre-models"
      sections={sections(locale)}
      otherApps={apps}
      aboutHref={`${appUrl('fibre-platform', process.env)}/settings/about`}
      link={Link}
      locale={locale}
    />
  );
}
