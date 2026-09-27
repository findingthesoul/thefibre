import Link from 'next/link';
import { headers } from 'next/headers';
import { appUrl } from '@thefibre/shared';
import { HelpPage, guideSteps, type HelpGuide, type HelpSection } from '@thefibre/shared/ui/help';
import { apiFetch } from '@/lib/api';
import { buildAppList } from '@thefibre/shared/available-apps';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import type { Locale } from '@thefibre/shared';

// Connect's Help page (2026-09-27). The shared sidebar shell has linked to
// /help since it was extracted; until today the link 404'd here. The chrome
// is @thefibre/shared/ui/help, the same as every other app; this file only
// supplies the content, and the content is written from what the pages do —
// the sections mirror the NAV in components/shell/sidebar.tsx, the guides
// name the buttons and fields as the catalog spells them.

export const metadata = { title: 'Help — Connect' };

type Me = { memberships: { app: { slug: string } | { slug: string }[] | null }[] };
type WorkspaceApp = {
  deactivated_at: string | null;
  app: { slug: string } | { slug: string }[] | null;
};

// Mirrors NAV in components/shell/sidebar.tsx, in its order, with the intro
// each page already shows. Settings is not in the NAV (it is in the user
// menu) but it is where half the "why can't I…" answers live.
function sections(locale: Locale): HelpSection[] {
  return [
    { label: t(locale, 'nav_today'), href: '/today', blurb: t(locale, 'today_intro') },
    { label: t(locale, 'nav_attention'), href: '/attention', blurb: t(locale, 'attention_intro') },
    { label: t(locale, 'nav_landscape'), href: '/landscape', blurb: t(locale, 'landscape_intro') },
    { label: t(locale, 'nav_map'), href: '/map', blurb: t(locale, 'help_map_blurb') },
    { label: t(locale, 'nav_people'), href: '/people', blurb: t(locale, 'people_intro') },
    { label: t(locale, 'nav_tags'), href: '/tags', blurb: t(locale, 'tags_intro') },
    { label: t(locale, 'nav_entries'), href: '/entries', blurb: t(locale, 'entries_intro') },
    { label: t(locale, 'settings'), href: '/settings', blurb: t(locale, 'help_settings_blurb') },
  ];
}

// The manual, in the order a new user meets things: the morning page, then
// capturing, then the relationship facts, then the ways of looking, then
// housekeeping and the assistant. One guide = two catalog keys; the steps
// arrive as one string and are split here.
function guides(locale: Locale): HelpGuide[] {
  // Explicit keys, never a computed one: the catalog is typed so a missing
  // translation is a compile error, and a template key would throw that away.
  return [
    {
      title: t(locale, 'help_g_today_title'),
      steps: guideSteps(t(locale, 'help_g_today_steps')),
      href: '/today',
    },
    {
      title: t(locale, 'help_g_note_title'),
      steps: guideSteps(t(locale, 'help_g_note_steps')),
      href: '/people',
    },
    {
      title: t(locale, 'help_g_meeting_title'),
      steps: guideSteps(t(locale, 'help_g_meeting_steps')),
      href: '/today',
    },
    {
      title: t(locale, 'help_g_relation_title'),
      steps: guideSteps(t(locale, 'help_g_relation_steps')),
      href: '/people',
    },
    {
      title: t(locale, 'help_g_org_title'),
      steps: guideSteps(t(locale, 'help_g_org_steps')),
      href: '/map',
    },
    {
      title: t(locale, 'help_g_entries_title'),
      steps: guideSteps(t(locale, 'help_g_entries_steps')),
      href: '/entries',
    },
    {
      title: t(locale, 'help_g_landscape_title'),
      steps: guideSteps(t(locale, 'help_g_landscape_steps')),
      href: '/landscape',
    },
    {
      title: t(locale, 'help_g_map_title'),
      steps: guideSteps(t(locale, 'help_g_map_steps')),
      href: '/map',
    },
    {
      title: t(locale, 'help_g_tags_title'),
      steps: guideSteps(t(locale, 'help_g_tags_steps')),
      href: '/settings/tags',
    },
    {
      title: t(locale, 'help_g_assistant_title'),
      steps: guideSteps(t(locale, 'help_g_assistant_steps')),
      href: '/settings',
    },
  ];
}

export default async function ConnectHelpPage() {
  const locale = await uiLocale();
  let apps: { slug: string; name: string; url: string }[] = [];
  try {
    const me = await apiFetch<Me>('/api/v1/auth/me');
    const r = await apiFetch<{ items: WorkspaceApp[] }>('/api/v1/workspace-apps');
    apps = buildAppList({
      currentApp: 'fibre-sales',
      memberships: me.memberships,
      workspaceApps: r.items,
      env: process.env,
      host: (await headers()).get('host'),
    });
  } catch {
    apps = [];
  }

  return (
    <HelpPage
      appId="fibre-sales"
      sections={sections(locale)}
      guides={guides(locale)}
      otherApps={apps}
      aboutHref={`${appUrl('fibre-platform', process.env)}/settings/about`}
      link={Link}
      locale={locale}
    />
  );
}
