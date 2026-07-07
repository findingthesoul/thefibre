import { apiFetch } from '@/lib/api';
import { money } from '@/lib/money';

export const metadata = { title: 'Accounts · Fibre Pulse' };

type Account = {
  id: string;
  name: string;
  kind: 'bank' | 'reserve';
  parent_account_id: string | null;
  sync_mode: 'manual' | 'auto';
  latest_snapshot: { balance_cents: number; as_of_date: string } | null;
};

export default async function AccountsPage() {
  let items: Account[] = [];
  try {
    const r = await apiFetch<{ items: Account[] }>('/api/v1/pulse/accounts');
    items = r.items;
  } catch {
    /* empty state below */
  }

  const banks = items.filter((a) => a.kind === 'bank');
  const reserves = items.filter((a) => a.kind === 'reserve');

  return (
    <div className="px-6 py-10 max-w-5xl">
      <h1 className="text-[28px] font-semibold tracking-tight text-ink">Accounts</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Balance snapshots anchor the projection. Reserves are earmarked money — in the bank,
        not yours to spend.
      </p>

      {items.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-8 text-center">
          <p className="text-sm text-ink-muted">
            No accounts yet. Adding accounts and updating balances lands in the next release.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <AccountGroup title="Bank accounts" items={banks} />
          <AccountGroup title="Reserves" items={reserves} />
        </div>
      )}
    </div>
  );
}

function AccountGroup({ title, items }: { title: string; items: Account[] }) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
      <div className="px-5 py-3 border-b border-line text-sm font-semibold tracking-tight">
        {title}
      </div>
      {items.length === 0 ? (
        <div className="px-5 py-3 text-sm text-ink-muted">None yet.</div>
      ) : (
        <div className="divide-y divide-line/60">
          {items.map((a) => (
            <div key={a.id} className="px-5 py-3 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-ink truncate">{a.name}</div>
                <div className="text-xs text-ink-muted">
                  {a.latest_snapshot
                    ? `as of ${a.latest_snapshot.as_of_date}`
                    : 'no balance yet'}
                  {a.sync_mode === 'auto' ? ' · auto' : ''}
                </div>
              </div>
              <span className="text-sm font-medium text-ink">
                {a.latest_snapshot ? money(a.latest_snapshot.balance_cents) : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
