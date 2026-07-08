import { apiFetch } from '@/lib/api';
import { AccountsActions, AccountsList, type Account } from './accounts-client';

export const metadata = { title: 'Accounts · Fibre Pulse' };

export default async function AccountsPage() {
  let items: Account[] = [];
  try {
    const r = await apiFetch<{ items: Account[] }>('/api/v1/pulse/accounts');
    items = r.items;
  } catch {
    /* empty state below */
  }

  return (
    <div className="px-6 py-10 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">Accounts</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Balance snapshots anchor the projection. Reserves are earmarked money — in the bank,
            not yours to spend.
          </p>
        </div>
        <div className="shrink-0 pt-1">
          <AccountsActions accounts={items} />
        </div>
      </div>

      <AccountsList accounts={items} />
    </div>
  );
}
