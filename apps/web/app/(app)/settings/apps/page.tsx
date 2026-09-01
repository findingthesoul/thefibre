import { redirect } from 'next/navigation';
import { APPS } from '@thefibre/shared';
import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  Breadcrumb,
  PageHeader,
  SectionLabel,
  ErrorBanner,
} from '@/components/ui/page';
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

// Display copy lives here (descriptions/status); names + taglines come from
// the shared APPS registry so renames/white-labels propagate.
const INSTALLABLE_META: Record<
  string,
  { body: string; status: 'Active' | 'Building' | 'Planned' }
> = {
  'fibre-meet': {
    body:
      'Run gatherings end-to-end: design the agenda, facilitate live, capture outcomes and action items. Curator data (change context, system context) lives in The Fibre, gated to Meet members.',
    status: 'Active',
  },
  'the-thread': {
    body:
      'Multi-session programmes, conferences, post-event journeys. Writes enrolment + attendance events back to The Fibre.',
    status: 'Active',
  },
  'fibre-flow': {
    body:
      'People-flow state machines: design a journey as a visual graph, move contacts through it, gate transitions on tasks. Writes step events back to The Fibre.',
    status: 'Active',
  },
  'fibre-pulse': {
    body:
      'Business planner — cashflow projection and budgeting on contacts and offerings. Opportunities, invoices and a pipeline that reads as a Flow; reads the purchase ledger for actuals.',
    status: 'Active',
  },
  'fibre-sales': {
    body:
      'Sovereign app — gated behind its own app membership. Curates commercial relationship + billing fields on organisations.',
    status: 'Building',
  },
  'fibre-learn': {
    body: 'Asynchronous content + reflections. Curates learning profile fields on persons.',
    status: 'Planned',
  },
};

// The list of installable apps comes from the catalogue, not from this file.
// It used to be a constant here — the web-side twin of the closed slug
// allow-list in the database. An approved third-party app now shows up on this
// page with no code change, which is the whole point of
// docs/brief-external-apps.md §1.
//
// First-party apps still get their hand-written copy from INSTALLABLE_META;
// a third-party one shows what it declared at registration.
function describe(a: CatalogueApp) {
  const meta = INSTALLABLE_META[a.slug];
  const known = a.slug in APPS ? APPS[a.slug as keyof typeof APPS] : null;
  return {
    slug: a.slug,
    name: known?.name ?? a.name,
    tagline: known?.tagline ?? (a.kind === 'third_party' ? 'Third-party app' : ''),
    body: meta?.body ?? a.description ?? 'No description supplied.',
    status: meta?.status ?? ('Active' as const),
    kind: a.kind,
    released: !!a.released_at,
    link: a.homepage_url ?? a.base_url,
  };
}

export default async function WorkspaceAppsPage() {
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

  // First party first, then alphabetically — so the apps someone recognises
  // don't get pushed down the page as third-party ones arrive.
  const available = catalogue
    .map(describe)
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
      <Breadcrumb href="/settings" label="Settings" />
      <PageHeader
        title="Apps"
        description="Turn apps on for this workspace. Each app brings its own pages, fields and activity events."
      />

      {error && <ErrorBanner>Couldn't load apps: {error}</ErrorBanner>}

      <section className="mt-10">
        <SectionLabel>Available</SectionLabel>
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
                        {a.kind === 'third_party' ? 'Third party' : a.status}
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
                        Manage API keys
                      </a>
                    )}
                  </div>
                  {a.released ? (
                    <AppToggle slug={a.slug} active={active} />
                  ) : (
                    /* Not built yet. No toggle at all rather than a disabled
                       one — a control you cannot use is worse than no control.
                       The API refuses this slug too, so the two agree. */
                    <span className="shrink-0 whitespace-nowrap rounded-full border border-line px-3 py-1 text-[10px] uppercase tracking-wider text-ink-muted">
                      Not built yet
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
