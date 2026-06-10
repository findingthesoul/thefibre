import type { Run, Step } from './runs-panel';

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v;
}

// A lightweight per-flow report computed from the current run snapshots.
// Honest scope: this is the *current distribution* of contacts across steps
// plus outcome totals — not a historical cohort funnel (we don't replay step
// history yet). Good enough to spot where people sit and pile up.
export function FlowReport({ runs, steps }: { runs: Run[]; steps: Step[] }) {
  const total = runs.length;
  const active = runs.filter((r) => r.status === 'active').length;
  const completed = runs.filter((r) => r.status === 'completed').length;
  const withdrawn = runs.filter((r) => r.status === 'withdrawn').length;

  const byStep = new Map<string, number>();
  for (const s of steps) byStep.set(s.key, 0);
  for (const r of runs) {
    const key = one(r.step)?.key;
    if (key && byStep.has(key)) byStep.set(key, (byStep.get(key) ?? 0) + 1);
  }
  const maxCount = Math.max(1, ...steps.map((s) => byStep.get(s.key) ?? 0));

  const KIND_BAR: Record<string, string> = {
    entry: 'bg-indigo-400',
    normal: 'bg-slate-300',
    end_positive: 'bg-emerald-400',
    end_negative: 'bg-rose-400',
  };

  if (total === 0) {
    return (
      <div className="mt-4 rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-8 text-center text-sm text-ink-subtle">
        No contacts in this flow yet — nothing to report.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total" value={total} />
        <Stat label="Active" value={active} accent="text-emerald-700" />
        <Stat label="Completed" value={completed} accent="text-indigo-600" />
        <Stat label="Withdrawn" value={withdrawn} accent="text-slate-400" />
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">Current distribution across steps</h3>
        <div className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-5 space-y-2.5">
          {steps.map((s) => {
            const n = byStep.get(s.key) ?? 0;
            const pct = Math.round((n / maxCount) * 100);
            return (
              <div key={s.key} className="flex items-center gap-3">
                <div className="w-36 shrink-0 text-sm truncate">{s.name}</div>
                <div className="flex-1 h-5 rounded bg-surface-sunken overflow-hidden">
                  <div
                    className={`h-full ${KIND_BAR[s.kind] ?? 'bg-neutral-400'}`}
                    style={{ width: `${n === 0 ? 0 : Math.max(pct, 6)}%` }}
                  />
                </div>
                <div className="w-8 shrink-0 text-right text-sm tabular-nums text-ink-subtle">{n}</div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          Shows where contacts sit right now. A historical cohort funnel (how many ever reached each step)
          comes with step-history tracking.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card px-5 py-4">
      <div className={`text-3xl font-semibold tabular-nums tracking-tight ${accent ?? ''}`}>{value}</div>
      <div className="text-xs text-ink-muted mt-0.5">{label}</div>
    </div>
  );
}
