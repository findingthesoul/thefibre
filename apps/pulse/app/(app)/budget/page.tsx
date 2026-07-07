import { apiFetch } from '@/lib/api';
import { money } from '@/lib/money';

export const metadata = { title: 'Budget · Fibre Pulse' };

type BudgetLine = {
  id: string;
  label: string;
  category: string | null;
  direction: 'in' | 'out';
  amount_cents: number;
  cadence: string;
  included: boolean;
  starts_on: string | null;
  ends_on: string | null;
};

export default async function BudgetPage() {
  let items: BudgetLine[] = [];
  try {
    const r = await apiFetch<{ items: BudgetLine[] }>('/api/v1/pulse/budget-lines');
    items = r.items;
  } catch {
    /* empty state below */
  }

  const byCategory = new Map<string, BudgetLine[]>();
  for (const l of items) {
    const key = l.category ?? 'Uncategorised';
    const list = byCategory.get(key) ?? [];
    list.push(l);
    byCategory.set(key, list);
  }

  return (
    <div className="px-6 py-10 max-w-5xl">
      <h1 className="text-[28px] font-semibold tracking-tight text-ink">Budget</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Recurring lines expand into the projection automatically. Toggled-off lines stay here,
        out of the numbers.
      </p>

      {items.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-8 text-center">
          <p className="text-sm text-ink-muted">
            No budget lines yet. Editing lands in the next release — the importer seeds your
            current costs tab.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {[...byCategory.entries()].map(([category, lines]) => (
            <div key={category} className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
              <div className="px-5 py-3 border-b border-line text-sm font-semibold tracking-tight">
                {category}
              </div>
              <div className="divide-y divide-line/60">
                {lines.map((l) => (
                  <div key={l.id} className="px-5 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm truncate ${l.included ? 'text-ink' : 'text-ink-muted line-through'}`}
                      >
                        {l.label}
                      </div>
                      <div className="text-xs text-ink-muted">{l.cadence}</div>
                    </div>
                    <span
                      className={`text-sm font-medium w-28 text-right ${l.direction === 'out' ? 'text-red-600' : 'text-emerald-700'}`}
                    >
                      {l.direction === 'out' ? '−' : '+'}
                      {money(l.amount_cents)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
