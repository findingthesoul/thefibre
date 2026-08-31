'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createCategory, renameCategory, deleteCategory } from '../actions';

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  organiser_id: string | null;
};

const INPUT =
  'h-[34px] rounded-md border border-line bg-surface px-2.5 text-sm outline-none focus:border-ink';

export function CategoriesManager({
  initial,
  myOrganiserId,
}: {
  initial: CategoryRow[];
  myOrganiserId: string;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'workspace' | 'mine'>('workspace');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const r = await createCategory(trimmed, scope);
      if (!r.ok) return setError(r.error);
      setName('');
      router.refresh();
    });
  }

  function rename(row: CategoryRow, next: string) {
    const trimmed = next.trim();
    if (!trimmed || trimmed === row.name) return;
    startTransition(async () => {
      const r = await renameCategory(row.id, trimmed);
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  }

  function remove(row: CategoryRow) {
    setError(null);
    startTransition(async () => {
      const r = await deleteCategory(row.id);
      if (!r.ok) return setError(r.error);
      router.refresh();
    });
  }

  return (
    <div className="mt-8 max-w-xl">
      <div className="flex items-end gap-2">
        <label className="block flex-1">
          <span className="text-xs text-ink-subtle">New category</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="e.g. Festivals"
            className={`${INPUT} mt-1 w-full`}
          />
        </label>
        <label className="block">
          <span className="text-xs text-ink-subtle">Visible to</span>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as 'workspace' | 'mine')}
            className={`${INPUT} mt-1`}
          >
            <option value="workspace">Whole workspace</option>
            <option value="mine">Only me</option>
          </select>
        </label>
        <Button
          type="button"
          onClick={add}
          disabled={pending || !name.trim()}
          leading={<Plus size={14} />}
        >
          Add
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-surface">
        {initial.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-ink-subtle">
            No categories yet — add the first above.
          </li>
        )}
        {initial.map((row) => (
          <li key={row.id} className="flex items-center gap-3 px-4 py-2.5">
            <input
              defaultValue={row.name}
              onBlur={(e) => rename(row, e.target.value)}
              className="flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm outline-none hover:border-line focus:border-ink"
            />
            <code className="text-xs text-ink-muted">{row.slug}</code>
            <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] text-ink-muted ring-1 ring-line">
              {row.organiser_id
                ? row.organiser_id === myOrganiserId
                  ? 'Only me'
                  : 'Personal'
                : 'Workspace'}
            </span>
            <button
              type="button"
              onClick={() => remove(row)}
              disabled={pending}
              title="Delete — threads using it simply lose the label"
              className="text-ink-muted hover:text-red-700"
            >
              <Trash2 size={15} strokeWidth={1.75} />
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-muted">
        The code next to each name is what website embeds filter by — it stays the same when you
        rename, so embedded listings keep working.
      </p>
    </div>
  );
}
