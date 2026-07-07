import { apiFetch } from '@/lib/api';
import { money } from '@/lib/money';

export const metadata = { title: 'Pipeline · Fibre Pulse' };

type Line = {
  id: string;
  expected_date: string;
  amount_cents: number;
  invoiced_at: string | null;
  settled_at: string | null;
};

type Commitment = {
  id: string;
  direction: 'in' | 'out';
  label: string;
  stage: string;
  probability: number;
  person: { id: string; first_name: string; last_name: string } | null;
  organisation: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  offering: { id: string; name: string } | null;
  lines: Line[];
};

const STAGE_STYLE: Record<string, string> = {
  lead: 'bg-amber-50 text-amber-600',
  proposal: 'bg-indigo-50 text-indigo-600',
  committed: 'bg-emerald-50 text-emerald-600',
  done: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-slate-50 text-slate-400',
};

export default async function PipelinePage() {
  let items: Commitment[] = [];
  try {
    const r = await apiFetch<{ items: Commitment[] }>('/api/v1/pulse/commitments');
    items = r.items;
  } catch {
    /* empty state below */
  }

  // Group by counterparty (proposal §2.3 — the counterparty is the unit).
  const groups = new Map<string, { name: string; items: Commitment[] }>();
  for (const cm of items) {
    const name = cm.organisation?.name
      ?? (cm.person ? `${cm.person.first_name} ${cm.person.last_name}`.trim() : null)
      ?? 'No counterparty yet';
    const key = cm.organisation?.id ?? cm.person?.id ?? '—';
    const g = groups.get(key) ?? { name, items: [] };
    g.items.push(cm);
    groups.set(key, g);
  }

  return (
    <div className="px-6 py-10 max-w-5xl">
      <h1 className="text-[28px] font-semibold tracking-tight text-ink">Pipeline</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Opportunities per counterparty — every line weighted by its likelihood.
      </p>

      {groups.size === 0 ? (
        <div className="mt-10 rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-8 text-center">
          <p className="text-sm text-ink-muted">
            No opportunities yet. Adding and editing lands in the next release —
            the importer seeds your current spreadsheet.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {[...groups.values()].map((g) => (
            <div key={g.name} className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
              <div className="px-5 py-3 border-b border-line text-sm font-semibold tracking-tight">
                {g.name}
              </div>
              <div className="divide-y divide-line/60">
                {g.items.map((cm) => {
                  const open = cm.lines.filter((l) => !l.settled_at);
                  const total = open.reduce((a, l) => a + l.amount_cents, 0);
                  return (
                    <div key={cm.id} className="px-5 py-3 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-ink truncate">
                          {cm.label}
                          {cm.project && (
                            <span className="text-ink-muted"> · {cm.project.name}</span>
                          )}
                        </div>
                        <div className="text-xs text-ink-muted">
                          {open.length} expected payment{open.length === 1 ? '' : 's'}
                          {cm.direction === 'out' ? ' (outgoing)' : ''}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_STYLE[cm.stage] ?? ''}`}
                      >
                        {cm.stage}
                      </span>
                      <span className="text-xs text-ink-muted w-10 text-right">
                        {cm.probability}%
                      </span>
                      <span
                        className={`text-sm font-medium w-28 text-right ${cm.direction === 'out' ? 'text-red-600' : 'text-ink'}`}
                      >
                        {cm.direction === 'out' ? '−' : ''}
                        {money(total)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
