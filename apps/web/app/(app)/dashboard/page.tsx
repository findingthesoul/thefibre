import Link from 'next/link';
import { CalendarRange, Users, Building2, Activity } from 'lucide-react';
import { APPS, appName, type AppId } from '@thefibre/shared';
import { serverSupabase } from '@/lib/supabase/server';
import { apiFetch } from '@/lib/api';

const APP_DOMAINS: Record<string, string> = {
  'fibre-meet': APPS['fibre-meet'].url,
  'the-thread': APPS['the-thread'].url,
  'fibre-flow': APPS['fibre-flow'].url,
  'fibre-pulse': APPS['fibre-pulse'].url,
  'fibre-sales': APPS['fibre-sales'].url,
  'fibre-learn': APPS['fibre-learn'].url,
};

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

  const today = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  // Fire all snapshot fetches in parallel. Each is non-fatal.
  const [activity, programmes, persons, orgs, workspaceApps] = await Promise.all([
    safeFetch<{ items: Activity[] }>('/api/v1/activities?limit=6'),
    safeFetch<{ items: Programme[] }>('/api/v1/programs'),
    safeFetch<{ items: Person[] }>('/api/v1/persons?limit=4'),
    safeFetch<{ items: Org[] }>('/api/v1/organisations?limit=4'),
    safeFetch<{ items: WorkspaceApp[] }>('/api/v1/workspace-apps'),
  ]);

  const activeAppSlugs = new Set(
    (workspaceApps?.items ?? [])
      .map((w) => (!w.deactivated_at ? appOf(w)?.slug : null))
      .filter((s): s is string => !!s),
  );

  const activeProgrammes = (programmes?.items ?? []).filter((p) => p.status === 'active' || p.status === 'draft');

  return (
    <div className="mx-auto max-w-5xl px-8 py-12">
      <h1 className="text-3xl font-medium tracking-tight">Welcome, {firstName}</h1>
      <p className="mt-1 text-sm text-ink-subtle">{today}</p>

      <section className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Contacts" value={persons?.items.length} icon={<Users size={16} strokeWidth={1.75} />} href="/contacts" />
        <Stat label="Organisations" value={orgs?.items.length} icon={<Building2 size={16} strokeWidth={1.75} />} href="/organisations" />
        <Stat label="Programmes" value={programmes?.items.length} icon={<CalendarRange size={16} strokeWidth={1.75} />} href="/programmes" />
        <Stat label="Activity" value={activity?.items.length} icon={<Activity size={16} strokeWidth={1.75} />} href="/activity" />
      </section>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
        <section>
          <div className="text-[10px] uppercase tracking-wider text-ink-muted">Recent activity</div>
          {activity && activity.items.length > 0 ? (
            <ol className="mt-3 border-l border-line pl-5 space-y-4">
              {activity.items.map((a) => (
                <li key={a.id} className="relative">
                  <span className="absolute -left-[22px] top-1.5 w-2 h-2 rounded-full bg-ink" />
                  <div className="text-[10px] uppercase tracking-wider text-ink-muted">
                    {new Date(a.occurred_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    {' · '}{a.app?.name ?? a.type}
                  </div>
                  <div className="mt-0.5 text-sm">{a.subject}</div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-ink-subtle">Nothing yet.</p>
          )}
          <Link href="/activity" className="mt-4 inline-block text-xs text-ink-subtle hover:text-ink underline underline-offset-2">
            See all →
          </Link>
        </section>

        <section>
          <div className="text-[10px] uppercase tracking-wider text-ink-muted">Active programmes</div>
          {activeProgrammes.length > 0 ? (
            <ul className="mt-3 divide-y divide-line border border-line rounded-lg bg-surface-raised overflow-hidden">
              {activeProgrammes.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <Link href={`/programmes/${p.id}`} className="block px-4 py-3 hover:bg-surface-sunken">
                    <div className="font-medium text-sm truncate">{p.title}</div>
                    <div className="text-xs text-ink-subtle mt-0.5">
                      {p.format}{p.starts_on && ` · starts ${new Date(p.starts_on).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-ink-subtle">No active programmes.</p>
          )}
          <Link href="/programmes" className="mt-4 inline-block text-xs text-ink-subtle hover:text-ink underline underline-offset-2">
            See all →
          </Link>
        </section>
      </div>

      <section className="mt-14">
        <div className="flex items-baseline justify-between">
          <div className="text-[10px] uppercase tracking-wider text-ink-muted">Your apps</div>
          <Link
            href="/settings/apps"
            className="text-xs text-ink-subtle hover:text-ink underline underline-offset-2"
          >
            Manage →
          </Link>
        </div>
        {activeAppSlugs.size === 0 ? (
          <div className="mt-3 rounded-lg border border-line bg-surface-sunken p-5 text-sm text-ink-subtle">
            No apps activated yet for this workspace.{' '}
            <Link href="/settings/apps" className="underline">
              Turn on an app
            </Link>{' '}
            to get started.
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line border border-line rounded-lg bg-surface-raised overflow-hidden">
            {Array.from(activeAppSlugs)
              .filter((slug) => memberships.includes(slug))
              .map((slug) => (
                <li key={slug}>
                  <Link
                    href={APP_DOMAINS[slug] ?? '#'}
                    className="flex items-baseline justify-between px-5 py-4 hover:bg-surface-sunken"
                  >
                    <span className="font-medium">{appName(slug as AppId) ?? slug}</span>
                    <span className="text-sm text-ink-subtle">Open →</span>
                  </Link>
                </li>
              ))}
          </ul>
        )}
      </section>
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
