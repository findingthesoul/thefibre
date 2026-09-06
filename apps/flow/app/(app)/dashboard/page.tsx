import { Workflow, CheckSquare, Users, Star, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { t, type UiKey } from '@/lib/i18n-ui';

export const metadata = { title: 'Flow' };

type FlowRow = {
  id: string;
  name: string;
  description: string | null;
  lifecycle: string;
  active_run_count: number;
  is_favorite: boolean;
};

const LIFECYCLE_STYLE: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-600',
  active: 'bg-emerald-50 text-emerald-600',
  closed: 'bg-slate-100 text-slate-500',
  archived: 'bg-slate-50 text-slate-400',
};

const LIFECYCLE_KEY: Record<string, UiKey> = {
  draft: 'lifecycle_draft',
  active: 'lifecycle_active',
  closed: 'lifecycle_closed',
  archived: 'lifecycle_archived',
};

export default async function FlowDashboard() {
  const locale = await uiLocale();
  let favorites: FlowRow[] = [];
  let taskCount = 0;
  let motionCount = 0;
  try {
    const [favR, taskR, runR] = await Promise.all([
      apiFetch<{ items: FlowRow[] }>('/api/v1/flow/flows?favorite=1'),
      apiFetch<{ items: unknown[] }>('/api/v1/flow/tasks?scope=mine&status=open'),
      apiFetch<{ items: unknown[] }>('/api/v1/flow/runs?status=active'),
    ]);
    favorites = favR.items;
    taskCount = taskR.items.length;
    motionCount = runR.items.length;
  } catch {
    /* non-fatal — dashboard still renders the quick-links */
  }

  return (
    <div className="px-6 py-10 max-w-5xl">
      <h1 className="text-[28px] font-semibold tracking-tight text-ink">{t(locale, 'welcome_back')}</h1>
      <p className="mt-1 text-sm text-ink-muted">{t(locale, 'moving_today')}</p>

      {/* stat cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          href="/tasks"
          icon={CheckSquare}
          tint="indigo"
          value={taskCount}
          label={t(locale, 'open_tasks')}
          sub={t(locale, 'assigned_to_you')}
        />
        <StatCard
          href="/contacts"
          icon={Users}
          tint="emerald"
          value={motionCount}
          label={t(locale, 'in_motion')}
          sub={t(locale, 'contacts_across_flows')}
        />
        <StatCard
          href="/flows"
          icon={Workflow}
          tint="violet"
          value={favorites.length}
          label={t(locale, 'favourite_flows')}
          sub={t(locale, 'pinned_here')}
        />
      </div>

      {/* favourite flows */}
      <div className="mt-10">
        <div className="flex items-center gap-2 mb-4">
          <Star size={16} strokeWidth={1.75} className="fill-amber-400 text-amber-500" />
          <h2 className="text-base font-semibold tracking-tight">{t(locale, 'favourite_flows')}</h2>
        </div>
        {favorites.length === 0 ? (
          <div className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-8 text-center">
            <div className="mx-auto mb-3 h-11 w-11 rounded-2xl bg-amber-50 flex items-center justify-center">
              <Star size={20} className="text-amber-500" />
            </div>
            <p className="text-sm text-ink-subtle max-w-sm mx-auto">
              {t(locale, 'no_favourites_before')}{' '}
              <Link href="/flows" className="text-ink font-medium underline underline-offset-2">
                {t(locale, 'flows')}
              </Link>{' '}
              {t(locale, 'no_favourites_after')}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {favorites.map((f) => (
              <Link
                key={f.id}
                href={`/flows/${f.id}`}
                className="group rounded-2xl bg-white ring-1 ring-black/5 shadow-card hover:shadow-card-hover transition-shadow p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="h-10 w-10 rounded-xl bg-violet-50 flex items-center justify-center">
                    <Workflow size={18} strokeWidth={1.75} className="text-violet-600" />
                  </div>
                  <ArrowUpRight
                    size={18}
                    className="text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="font-medium truncate">{f.name}</span>
                  <span
                    className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      LIFECYCLE_STYLE[f.lifecycle] ?? ''
                    }`}
                  >
                    {t(locale, LIFECYCLE_KEY[f.lifecycle] ?? 'lifecycle_draft')}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {t(locale, 'n_contacts_in_motion', { n: f.active_run_count })}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const TINT: Record<string, { bg: string; fg: string }> = {
  indigo: { bg: 'bg-indigo-50', fg: 'text-indigo-600' },
  emerald: { bg: 'bg-emerald-50', fg: 'text-emerald-600' },
  violet: { bg: 'bg-violet-50', fg: 'text-violet-600' },
};

function StatCard({
  href,
  icon: Icon,
  tint,
  value,
  label,
  sub,
}: {
  href: string;
  icon: typeof Workflow;
  tint: keyof typeof TINT;
  value: number;
  label: string;
  sub: string;
}) {
  const tone = TINT[tint];
  return (
    <Link
      href={href}
      className="group rounded-2xl bg-white ring-1 ring-black/5 shadow-card hover:shadow-card-hover transition-shadow p-5"
    >
      <div className="flex items-center justify-between">
        <div className={`h-10 w-10 rounded-xl ${tone.bg} flex items-center justify-center`}>
          <Icon size={18} strokeWidth={1.75} className={tone.fg} />
        </div>
        <ArrowUpRight
          size={18}
          className="text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </div>
      <div className="mt-4 text-3xl font-semibold tabular-nums tracking-tight">{value}</div>
      <div className="mt-0.5 text-sm font-medium text-ink">{label}</div>
      <div className="text-xs text-ink-muted">{sub}</div>
    </Link>
  );
}
