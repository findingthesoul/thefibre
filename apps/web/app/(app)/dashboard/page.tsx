import Link from 'next/link';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { CalendarRange, Users, Building2, Activity } from 'lucide-react';
import { APPS, APP_IDS, appName, type AppId } from '@thefibre/shared';
import { crossAppHref } from '@thefibre/shared/sso-hop';
import { serverSupabase } from '@/lib/supabase/server';
import { apiFetch } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { t, INTL_LOCALES } from '@/lib/i18n-ui';
import { COOKIE_WELCOME, COOKIE_LAUNCHER, COOKIE_APPS_SECTION } from '@/lib/prefs-shared';
import type { PublicProfile } from '../settings/profile/profile-form';
import { LauncherOverlay, type LauncherApp } from './launcher-overlay';
import { AppsSection } from './apps-section';

// crossAppHref (env-aware), NEVER APPS[slug].url: the raw registry value is
// the PRODUCTION default, so the staging dashboard linked people to
// production — where their staging session doesn't exist ("going to Meet
// lands me on a login page", Sjoerd 2026-09-05). Derived from APP_IDS so a
// new app can't be forgotten (the old hardcoded map was missing Membership).
// A target on the other apex becomes a /sso/hop link carrying the session.
const APP_DOMAINS: Record<string, string> = Object.fromEntries(
  APP_IDS.filter((s) => s !== 'fibre-platform').map((s) => [
    s,
    crossAppHref('fibre-platform', s, process.env),
  ]),
);

// The launcher's order: Thread first (the flagship — naming brief), then
// the tools in its service.
// Sjoerd's tile filenames (2026-09-07: "fibre meet = meet, membership =
// members…") — his names first, slug as fallback.
const TILE_NAMES: Partial<Record<AppId, string>> = {
  'the-thread': 'thethread',
  'fibre-meet': 'meet',
  'membership': 'members',
  'fibre-pulse': 'pulse',
  'fibre-flow': 'flow',
  'fibre-platform': 'fibre',
};
function tileArt(slug: AppId): string | null {
  for (const base of [TILE_NAMES[slug], slug]) {
    if (base && existsSync(join(process.cwd(), 'public', 'brand', 'apps', `${base}.png`))) {
      return `/brand/apps/${base}.png`;
    }
  }
  return null;
}

// The Fibre closes the weave (backstage position — naming brief); its
// tile links home. Six apps + two fillers = the full 4×2 poster.
const LAUNCH_ORDER: AppId[] = ['the-thread', 'fibre-meet', 'membership', 'fibre-pulse', 'fibre-flow', 'fibre-platform'];

type Activity = {
  id: string;
  person_id: string;
  type: string;
  subject: string;
  occurred_at: string;
  app: { slug: string; name: string } | null;
};
type Programme = { id: string; title: string; format: string; status: string; starts_on: string | null; ends_on: string | null };
type Person = { id: string; first_name: string | null; last_name: string | null; email: string | null };
type Org = { id: string; name: string };
type AppRef = { slug: string; name: string; base_url: string | null };
type WorkspaceApp = {
  id: string;
  deactivated_at: string | null;
  app: AppRef | AppRef[] | null;
};
function appOf(w: WorkspaceApp): AppRef | null {
  if (!w.app) return null;
  return Array.isArray(w.app) ? w.app[0] ?? null : w.app;
}

export default async function Dashboard() {
  const locale = await uiLocale();
  const supabase = await serverSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: { session } } = await supabase.auth.getSession();
  const claims = session?.access_token
    ? JSON.parse(Buffer.from(session.access_token.split('.')[1] ?? '', 'base64').toString())
    : {};
  const memberships: string[] = claims.app_memberships ?? [];

  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email ??
    '';
  const firstName = fullName.split(/\s+/)[0] ?? '';

  const today = new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  // Fire all snapshot fetches in parallel. Each is non-fatal.
  const [activity, programmes, persons, orgs, workspaceApps, profile] = await Promise.all([
    safeFetch<{ items: Activity[] }>('/api/v1/activities?limit=6'),
    safeFetch<{ items: Programme[] }>('/api/v1/programs'),
    safeFetch<{ items: Person[] }>('/api/v1/persons?limit=4'),
    safeFetch<{ items: Org[] }>('/api/v1/organisations?limit=4'),
    safeFetch<{ items: WorkspaceApp[] }>('/api/v1/workspace-apps'),
    safeFetch<PublicProfile>('/api/v1/profile'),
  ]);

  // First login, derived (onboarding rule: no wizard state): an empty
  // identity_profile means nobody set themselves up yet — walk them through
  // the welcome sequence once. The dismiss cookie is the only stored bit.
  const cookieStore = await cookies();
  const welcomeDone = cookieStore.get(COOKIE_WELCOME)?.value === 'done';
  const launcherOff = cookieStore.get(COOKIE_LAUNCHER)?.value === 'off';
  const appsCollapsed = cookieStore.get(COOKIE_APPS_SECTION)?.value === 'collapsed';
  const profileEmpty =
    profile != null && !profile.display_name && !profile.timezone && !profile.photo_url;
  if (profileEmpty && !welcomeDone) redirect('/welcome');

  const activeAppSlugs = new Set(
    (workspaceApps?.items ?? [])
      .map((w) => (!w.deactivated_at ? appOf(w)?.slug : null))
      .filter((s): s is string => !!s),
  );

  const activeProgrammes = (programmes?.items ?? []).filter((p) => p.status === 'active' || p.status === 'draft');

  // The seat's apps: activated for the workspace AND on this user's seat.
  const seatApps = LAUNCH_ORDER.filter(
    // fibre-platform is the app you are standing in — always on the seat
    // (workspace_app has no row for it; you cannot deactivate the platform
    // from itself — same rule as /auth/me's membership filter).
    (slug) =>
      slug === 'fibre-platform' ||
      (activeAppSlugs.has(slug) && memberships.includes(slug)),
  );
  const launcherApps: LauncherApp[] = seatApps.map((slug) => ({
    slug,
    name: APPS[slug].name,
    tagline: APPS[slug].tagline,
    letters: APPS[slug].brandLetters,
    // Matisse tile art — Sjoerd's filenames (he named the files, the code
    // follows): thethread/meet/members/pulse/flow/fibre.png, slug names
    // accepted as fallback. Missing file → the yellow brand-letters tile.
    art: tileArt(slug),
    href: slug === 'fibre-platform' ? '/dashboard' : (APP_DOMAINS[slug] ?? '#'),
  }));
  // Decorative tapestry fillers: the launcher popup is ONE poster — 4 tiles
  // × 2 rows (Sjoerd: "the icons together make up one poster… a tapestry").
  // Apps fill the first cells in LAUNCH_ORDER; filler-1.png…filler-3.png
  // complete the weave. Missing files simply leave the grid shorter.
  const fillerArt = [1, 2, 3]
    .map((n) => `filler-${n}.png`)
    .filter((f) => existsSync(join(process.cwd(), 'public', 'brand', 'apps', f)))
    .map((f) => `/brand/apps/${f}`)
    .slice(0, Math.max(0, 8 - seatApps.length));

  return (
    <div className="mx-auto max-w-5xl px-8 py-12">
      {/* On entry the launcher pops above the page, dimmed backdrop —
          once per browser session; the same tiles stay inline below. */}
      {!launcherOff && <LauncherOverlay apps={launcherApps} fillers={fillerArt} locale={locale} />}
      <h1 className="text-3xl font-medium tracking-tight">
        {t(locale, 'welcome_name', { name: firstName })}
      </h1>
      <p className="mt-1 text-sm text-ink-subtle">{today}</p>

      <section className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label={t(locale, 'nav_contacts')} value={persons?.items.length} icon={<Users size={16} strokeWidth={1.75} />} href="/contacts" />
        <Stat label={t(locale, 'nav_organisations')} value={orgs?.items.length} icon={<Building2 size={16} strokeWidth={1.75} />} href="/organisations" />
        <Stat label={t(locale, 'nav_programmes')} value={programmes?.items.length} icon={<CalendarRange size={16} strokeWidth={1.75} />} href="/programmes" />
        <Stat label={t(locale, 'nav_activity')} value={activity?.items.length} icon={<Activity size={16} strokeWidth={1.75} />} href="/activity" />
      </section>

      {/* The seat's apps inline — foldable; the popup serves entry. */}
      {seatApps.length === 0 ? (
        <section className="mt-12">
          <div className="text-[10px] uppercase tracking-wider text-ink-muted">
            {t(locale, 'your_apps')}
          </div>
          <div className="mt-4 rounded-lg border border-line bg-surface-sunken p-5 text-sm text-ink-subtle">
            {t(locale, 'no_apps_activated')}{' '}
            <Link href="/settings/apps" className="underline">
              {t(locale, 'turn_on_an_app')}
            </Link>{' '}
            {t(locale, 'to_get_started')}
          </div>
        </section>
      ) : (
        <AppsSection apps={launcherApps} locale={locale} initialCollapsed={appsCollapsed} />
      )}


      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
        <section>
          <div className="text-[10px] uppercase tracking-wider text-ink-muted">
            {t(locale, 'recent_activity')}
          </div>
          {activity && activity.items.length > 0 ? (
            <ol className="mt-3 border-l border-line pl-5 space-y-4">
              {activity.items.map((a) => (
                <li key={a.id} className="relative">
                  <span className="absolute -left-[22px] top-1.5 w-2 h-2 rounded-full bg-ink" />
                  <div className="text-[10px] uppercase tracking-wider text-ink-muted">
                    {new Date(a.occurred_at).toLocaleDateString(INTL_LOCALES[locale], { day: 'numeric', month: 'short' })}
                    {' · '}{a.app?.name ?? a.type}
                  </div>
                  <div className="mt-0.5 text-sm">{a.subject}</div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-ink-subtle">{t(locale, 'nothing_yet')}</p>
          )}
          <Link href="/activity" className="mt-4 inline-block text-xs text-ink-subtle hover:text-ink underline underline-offset-2">
            {t(locale, 'see_all')} →
          </Link>
        </section>

        <section>
          <div className="text-[10px] uppercase tracking-wider text-ink-muted">
            {t(locale, 'active_programmes')}
          </div>
          {activeProgrammes.length > 0 ? (
            <ul className="mt-3 divide-y divide-line border border-line rounded-lg bg-surface-raised overflow-hidden">
              {activeProgrammes.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <Link href={`/programmes/${p.id}`} className="block px-4 py-3 hover:bg-surface-sunken">
                    <div className="font-medium text-sm truncate">{p.title}</div>
                    <div className="text-xs text-ink-subtle mt-0.5">
                      {p.format}{p.starts_on && ` · ${t(locale, 'starts')} ${new Date(p.starts_on).toLocaleDateString(INTL_LOCALES[locale], { day: 'numeric', month: 'short' })}`}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-ink-subtle">{t(locale, 'no_active_programmes')}</p>
          )}
          <Link href="/programmes" className="mt-4 inline-block text-xs text-ink-subtle hover:text-ink underline underline-offset-2">
            {t(locale, 'see_all')} →
          </Link>
        </section>
      </div>

    </div>
  );
}

async function safeFetch<T>(path: string): Promise<T | null> {
  try {
    return await apiFetch<T>(path);
  } catch {
    return null;
  }
}

function Stat({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-line bg-surface-raised p-4 hover:bg-surface-sunken"
    >
      <div className="flex items-center gap-2 text-ink-subtle">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-medium tracking-tight">
        {value ?? '—'}
      </div>
    </Link>
  );
}
