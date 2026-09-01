import { apiFetch } from '@/lib/api';
import { BudgetActions, BudgetList, type BudgetLine, type Member } from './budget-client';

export const metadata = { title: 'Budget · Pulse' };

export default async function BudgetPage() {
  let items: BudgetLine[] = [];
  let members: Member[] = [];
  try {
    const r = await apiFetch<{ items: BudgetLine[] }>('/api/v1/pulse/budget-lines');
    items = r.items;
  } catch {
    /* empty state below */
  }
  try {
    const r = await apiFetch<{ items: Member[] }>('/api/v1/members');
    members = r.items;
  } catch {
    /* owner select just shows "nobody" */
  }

  return (
    <div className="px-6 py-10 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">Budget</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Recurring lines expand into the projection automatically. Toggled-off lines stay here,
            out of the numbers.
          </p>
        </div>
        <div className="shrink-0 pt-1">
          <BudgetActions members={members} />
        </div>
      </div>

      <BudgetList lines={items} members={members} />
    </div>
  );
}
