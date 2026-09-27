import Link from 'next/link';
import { headers } from 'next/headers';
import { appName, appUrl } from '@thefibre/shared';
import { HelpPage, guideSteps, type HelpGuide, type HelpSection } from '@thefibre/shared/ui/help';
import { apiFetch } from '@/lib/api';
import { buildAppList } from '@thefibre/shared/available-apps';
import { uiLocale } from '@/lib/locale';
import { t, type Locale } from '@/lib/i18n-ui';

export const metadata = { title: `Help — ${appName('fibre-models')}` };

type Me = { memberships: { app: { slug: string } | { slug: string }[] | null }[] };
type WorkspaceApp = { deactivated_at: string | null; app: { slug: string } | { slug: string }[] | null };

function sections(locale: Locale): HelpSection[] {
  return [
    { label: t(locale, 'nav_models'), href: '/dashboard', blurb: t(locale, 'help_home_blurb') },
    { label: t(locale, 'nav_settings'), href: '/settings', blurb: t(locale, 'settings_blurb') },
  ];
}

// The manual, in the order a person meets things: start a model, the canvas,
// the Numbers tab and its drawer, the structure editors, the per-month grid,
// scenarios, band tables, the reserve, and the assistant. Every guide but the
// first happens inside an open model, so "Open" leads to the list where one
// is picked; the assistant guide starts in The Fibre and carries no link.
const GUIDES = [
  { slug: 'start', href: '/dashboard' },
  { slug: 'canvas', href: '/dashboard' },
  { slug: 'numbers', href: '/dashboard' },
  { slug: 'structure', href: '/dashboard' },
  { slug: 'resources', href: '/dashboard' },
  { slug: 'periods', href: '/dashboard' },
  { slug: 'scenarios', href: '/dashboard' },
  { slug: 'tables', href: '/dashboard' },
  { slug: 'reserve', href: '/dashboard' },
  { slug: 'assistant', href: undefined },
] as const;
type Slug = (typeof GUIDES)[number]['slug'];

function guides(locale: Locale): HelpGuide[] {
  return GUIDES.map(({ slug, href }) => ({
    title: t(locale, `help_g_${slug}_title` as `help_g_${Slug}_title`),
    steps: guideSteps(t(locale, `help_g_${slug}_steps` as `help_g_${Slug}_steps`)),
    href,
  }));
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
      guides={guides(locale)}
      otherApps={apps}
      aboutHref={`${appUrl('fibre-platform', process.env)}/settings/about`}
      link={Link}
      locale={locale}
    />
  );
}
