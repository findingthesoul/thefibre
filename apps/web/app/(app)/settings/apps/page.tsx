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
      'Business planner — cashflow projection and budgeting on contacts and offerings. Opportunities, invoices and a pipeline that reads as a Fibre Flow; reads the purchase ledger for actuals.',
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

const INSTALLABLE = (['fibre-meet', 'the-thread', 'fibre-flow', 'fibre-pulse', 'fibre-sales', 'fibre-learn'] as const).map(
  (slug) => {
    const meta = INSTALLABLE_META[slug]!;
    return {
      slug,
      name: APPS[slug].name,
      tagline: APPS[slug].tagline,
      body: meta.body,
      status: meta.status,
    };
  },
);

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
          {INSTALLABLE.map((a) => {
            const inst = installedBySlug.get(a.slug);
            const active = !!inst && !inst.deactivated_at;
            return (
              <li
                key={a.slug}
                className="rounded-lg border border-line bg-surface-raised p-5"
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-3">
                      <h3 className="text-base font-medium">{a.name}</h3>
                      <span className="text-[10px] uppercase tracking-wider text-ink-muted">
                        {a.status}
                      </span>
                    </div>
                    <div className="text-sm text-ink-subtle mt-1">{a.tagline}</div>
                    <p className="mt-3 text-sm text-ink-subtle max-w-2xl leading-relaxed">
                      {a.body}
                    </p>
                  </div>
                  <AppToggle slug={a.slug} active={active} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </PageContainer>
  );
}
