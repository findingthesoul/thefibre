import { redirect } from 'next/navigation';
import { APPS, appUrl } from '@thefibre/shared';
import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  Breadcrumb,
  PageHeader,
  SectionLabel,
  ErrorBanner,
} from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';
import { AppToggle } from './toggle';

type AppRef = { slug: string; name: string; base_url: string | null };

type CatalogueApp = {
  slug: string;
  name: string;
  description: string | null;
  homepage_url: string | null;
  base_url: string | null;
  status: 'pending' | 'approved' | 'suspended';
  kind: 'first_party' | 'third_party';
  /** null = not built yet. See 20260824210000_app_released_at.sql. */
  released_at: string | null;
};
type WorkspaceApp = {
  id: string;
  app_id: string;
  activated_at: string;
  deactivated_at: string | null;
  // PostgREST returns embedded FKs as either an object or a single-element array,
  // depending on relationship inference. Handle both.
  app: AppRef | AppRef[] | null;
};

function appOf(w: WorkspaceApp): AppRef | null {
  if (!w.app) return null;
  return Array.isArray(w.app) ? w.app[0] ?? null : w.app;
}

type Me = {
  user: { id: string; is_super_admin?: boolean };
  memberships: { app: { slug: string } | { slug: string }[] | null; role: string }[];
};

// Display copy lives in the i18n catalog (descriptions/status); names +
// taglines come from the shared APPS registry so renames/white-labels
// propagate.
const INSTALLABLE_META: Record<
  string,
  { body: UiKey; status: 'app_status_active' | 'app_status_building' | 'app_status_planned' }
> = {
  'fibre-meet': { body: 'app_body_meet', status: 'app_status_active' },
  'the-thread': { body: 'app_body_thread', status: 'app_status_active' },
  'fibre-flow': { body: 'app_body_flow', status: 'app_status_active' },
  'fibre-pulse': { body: 'app_body_pulse', status: 'app_status_active' },
  'fibre-sales': { body: 'app_body_sales', status: 'app_status_building' },
  'fibre-learn': { body: 'app_body_learn', status: 'app_status_planned' },
};

// The list of installable apps comes from the catalogue, not from this file.
// It used to be a constant here — the web-side twin of the closed slug
// allow-list in the database. An approved third-party app now shows up on this
// page with no code change, which is the whole point of
// docs/brief-external-apps.md §1.
//
// First-party apps still get their hand-written copy from INSTALLABLE_META;
// a third-party one shows what it declared at registration.
function describe(a: CatalogueApp, locale: Locale) {
  const meta = INSTALLABLE_META[a.slug];
  const known = a.slug in APPS ? APPS[a.slug as keyof typeof APPS] : null;
  return {
    slug: a.slug,
    name: known?.name ?? a.name,
    tagline: known?.tagline ?? (a.kind === 'third_party' ? t(locale, 'third_party_app') : ''),
    // A third-party app's own description is content it registered — verbatim.
    body: meta ? t(locale, meta.body) : (a.description ?? t(locale, 'no_description')),
    status: t(locale, meta?.status ?? 'app_status_active'),
    kind: a.kind,
    released: !!a.released_at,
    // In-family apps link via appUrl (env-aware — the catalogue's base_url
    // is the production address even in the staging DB); third-party apps
    // keep their own declared link.
    link: known ? appUrl(a.slug as keyof typeof APPS, process.env) : (a.homepage_url ?? a.base_url),
  };
}

export default async function WorkspaceAppsPage() {
  const locale = await uiLocale();
  let me: Me | null = null;
  let installed: WorkspaceApp[] = [];
  let error: string | null = null;

  try {
    me = await apiFetch<Me>('/api/v1/auth/me');
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  const explicitAdmin =
    me?.memberships?.some((m) => {
      const app = Array.isArray(m.app) ? m.app[0] : m.app;
      return app?.slug === 'fibre-platform' && m.role === 'admin';
    }) ?? false;
  const isWorkspaceAdmin = explicitAdmin || !!me?.user.is_super_admin;

  if (me && !isWorkspaceAdmin) {
    // Settings → Apps is admin-only. Non-admins go back to Settings.
    redirect('/settings');
  }

  try {
    const data = await apiFetch<{ items: WorkspaceApp[] }>(`/api/v1/workspace-apps`);
    installed = data.items;
  } catch (e) {
    if (!error) error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  let catalogue: CatalogueApp[] = [];
  try {
    const data = await apiFetch<{ items: CatalogueApp[] }>(`/api/v1/apps?status=approved`);
    // fibre-platform is not installable — it IS the platform.
    catalogue = data.items.filter((a) => a.slug !== 'fibre-platform');
  } catch (e) {
    if (!error) error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  // Apps outside the workspace's plan are NOT shown (Signup v2, Sjoerd
  // 2026-09-03: "other apps are not visible") — the plan decides the product,
  // this page manages it. An app that is somehow already ACTIVE stays visible
  // regardless, so a downgrade never hides a switch you might need.
  // Fail OPEN like the gates: an unreadable plan hides nothing.
  let features: Record<string, unknown> = { flow: true, pulse: true, third_party_apps: true };
  try {
    const p = await apiFetch<{ plan: { id: string; features: Record<string, unknown> } }>(
      '/api/v1/plan',
    );
    if (p.plan.id !== 'unknown') features = p.plan.features;
  } catch {
    /* keep the open fallback */
  }
  const activeSlugs = new Set(
    installed.filter((w) => !w.deactivated_at).map((w) => appOf(w)?.slug ?? ''),
  );
  const inPlan = (a: CatalogueApp): boolean => {
    if (activeSlugs.has(a.slug)) return true;
    if (a.kind === 'third_party') return features.third_party_apps === true;
    if (a.slug === 'fibre-flow') return features.flow === true;
    if (a.slug === 'fibre-pulse') return features.pulse === true;
    return true; // Meet, Thread, and the not-built-yet roadmap entries
  };
  catalogue = catalogue.filter(inPlan);

  // First party first, then alphabetically — so the apps someone recognises
  // don't get pushed down the page as third-party ones arrive.
  const available = catalogue
    .map((a) => describe(a, locale))
    .sort((a, b) => {
      // Things you can actually switch on come first; the not-built-yet ones
      // sink to the bottom where they read as a roadmap rather than a menu.
      if (a.released !== b.released) return a.released ? -1 : 1;
      if (a.kind !== b.kind) return a.kind === 'first_party' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const installedBySlug = new Map(
    installed.map((w) => [appOf(w)?.slug ?? '', w] as const),
  );

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/settings" label={t(locale, 'nav_settings')} />
      <PageHeader
        title={t(locale, 'nav_apps')}
        description={t(locale, 'apps_page_blurb')}
      />

      {error && <ErrorBanner>{t(locale, 'apps_load_failed')} {error}</ErrorBanner>}

      <section className="mt-10">
        <SectionLabel>{t(locale, 'available')}</SectionLabel>
        <ul className="mt-4 space-y-3">
          {available.map((a) => {
            const inst = installedBySlug.get(a.slug);
            const active = !!inst && !inst.deactivated_at;
            return (
              <li
                key={a.slug}
                className={`rounded-lg border border-line p-5 ${
                  a.released ? 'bg-surface-raised' : 'bg-surface-sunken opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-3">
                      <h3 className="text-base font-medium">{a.name}</h3>
                      <span className="text-[10px] uppercase tracking-wider text-ink-muted">
                        {a.kind === 'third_party' ? t(locale, 'third_party') : a.status}
                      </span>
                    </div>
                    {a.tagline && (
                      <div className="text-sm text-ink-subtle mt-1">{a.tagline}</div>
                    )}
                    <p className="mt-3 text-sm text-ink-subtle max-w-2xl leading-relaxed">
                      {a.body}
                    </p>
                    {a.kind === 'third_party' && active && (
                      <a
                        href={`/settings/apps/${encodeURIComponent(a.slug)}/keys`}
                        className="mt-3 inline-block text-sm text-ink-subtle underline underline-offset-2 hover:text-ink"
                      >
                        {t(locale, 'manage_api_keys')}
                      </a>
                    )}
                  </div>
                  {a.released ? (
                    <AppToggle slug={a.slug} active={active} locale={locale} />
                  ) : (
                    /* Not built yet. No toggle at all rather than a disabled
                       one — a control you cannot use is worse than no control.
                       The API refuses this slug too, so the two agree. */
                    <span className="shrink-0 whitespace-nowrap rounded-full border border-line px-3 py-1 text-[10px] uppercase tracking-wider text-ink-muted">
                      {t(locale, 'not_built_yet')}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </PageContainer>
  );
}
