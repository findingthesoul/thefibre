import { EmptyState } from '@/components/ui/page';

export type Workspace = {
  id: string;
  slug: string;
  name: string;
  plan: string;
  created_at: string;
  counts: {
    users: number;
    people: number;
    organisations: number;
    activities: number;
    apps: number;
  };
  is_empty: boolean;
  is_yours: boolean;
};

export function WorkspaceList({ items }: { items: Workspace[] }) {
  if (items.length === 0) {
    return <EmptyState>No workspaces. That should be impossible — check the API log.</EmptyState>;
  }
  return (
    <ul className="mt-4 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface-raised">
      {items.map((w) => (
        <li key={w.id} className="px-5 py-4">
          <div className="flex items-baseline justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="truncate font-medium">{w.name}</span>
                {w.is_yours && (
                  <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                    Yours
                  </span>
                )}
                {w.is_empty && (
                  <span className="shrink-0 rounded-full border border-amber-600/40 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-700 dark:border-amber-400/40 dark:text-amber-400">
                    Empty
                  </span>
                )}
              </div>
              <div className="mt-0.5 font-mono text-xs text-ink-muted">{w.slug}</div>
            </div>
            <div className="shrink-0 text-right text-xs text-ink-muted">
              <div className="uppercase tracking-wider">{w.plan}</div>
              <div className="mt-0.5">
                {new Date(w.created_at).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
              </div>
            </div>
          </div>

          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-muted">
            <Count label="Users" value={w.counts.users} />
            <Count label="Contacts" value={w.counts.people} />
            <Count label="Organisations" value={w.counts.organisations} />
            <Count label="Activity" value={w.counts.activities} />
            <Count label="Apps on" value={w.counts.apps} />
          </dl>
        </li>
      ))}
    </ul>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="uppercase tracking-wider">{label}</dt>
      {/* -1 means the count query itself failed. Say so rather than show a
          confident zero — on this page a false zero is the one wrong answer,
          because zero is exactly what "safe to delete" looks like. */}
      <dd className={`font-mono ${value > 0 ? 'text-ink' : ''}`}>{value < 0 ? '?' : value}</dd>
    </div>
  );
}
