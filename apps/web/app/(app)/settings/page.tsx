import Link from 'next/link';
import { SettingsCards, platformSettings } from '@thefibre/shared/ui/settings';
import { canManageWorkspace } from '@thefibre/shared';
import { apiFetch } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';

// The Fibre hosts nearly all of it — this is the platform, so "in The Fibre"
// is here. Same four sections, same order, same words as Thread, Meet, Flow
// and Pulse (packages/shared/src/ui/settings.tsx).
//
// What used to be here and is not any more: a read-only block repeating the
// workspace's name, slug, plan and creation date, and a list of your app
// memberships. Both were facts on a settings page you could not act on. The
// name is now editable at Settings → Workspace and the apps at Settings →
// Apps, which is what a person came here to do.

export const metadata = { title: 'Settings · The Fibre' };

type Me = {
  user: { is_super_admin?: boolean };
  /** Role in the ACTIVE workspace — what decides who may manage it. */
  workspace_role?: string | null;
  memberships: { app: { slug: string } | { slug: string }[] | null; role: string }[];
};

export default async function SettingsPage() {
  const locale = await uiLocale();
  // The hub asks the SAME question the admin-only pages ask, so it cannot
  // offer a door that then refuses. A failed load means "not an admin" —
  // canManageWorkspace fails closed, costing an admin one reload rather than
  // showing everyone a dead entry.
  const me = await apiFetch<Me>('/api/v1/auth/me').catch(() => null);
  const sections = platformSettings({
    locale,
    currentApp: 'fibre-platform',
    env: process.env,
    // Everything reusable is HERE, including the two that used to be omitted.
    //
    // Sjoerd, 2026-09-23: *"the settings for my company: payment etc. is
    // needed in 4 apps, but it does not show in the fibre settings... I expect
    // that reusable items (also calender connection etc. and zoom) are always
    // there."*
    //
    // The old note said payments and connections "are set up inside the apps
    // that use them", which was true of the PAGES and never of the DATA:
    // payments has been platform-level since 2026-07-04 and the calendar and
    // meeting-room connection since v0.13.107, both with one reader each. So
    // four apps showed a form for values this app owns, and this app showed
    // nothing. The connections page was already here — just not listed.
    //
    // The app copies stay. Somebody setting up Meet should not have to leave
    // Meet to finish; the point is that the platform is where you can always
    // find it, not that it is the only door.
    hosted: [
      'profile', 'workspace', 'domain', 'members', 'teams', 'apps', 'assistant', 'plan',
      'payments', 'connections', 'about', 'privacy',
    ],
    canManage: canManageWorkspace(me),
  });

  return (
    <PageContainer max="4xl">
      <PageHeader
        title={t(locale, 'nav_settings')}
        description={t(locale, 'settings_blurb')}
      />
      <SettingsCards sections={sections} link={Link} locale={locale} />
    </PageContainer>
  );
}
