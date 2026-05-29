import Link from 'next/link';
import { Workflow } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { NewFlowButton } from './new-flow';

export const metadata = { title: 'Flows — Fibre Flow' };

type FlowRow = {
  id: string;
  name: string;
  description: string | null;
  scope: 'personal' | 'team' | 'workspace';
  lifecycle: 'draft' | 'active' | 'closed' | 'archived';
  active_run_count: number;
  updated_at: string;
};

const LIFECYCLE_STYLE: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800',
  active: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-neutral-200 text-neutral-700',
  archived: 'bg-neutral-100 text-neutral-500',
};

const SCOPE_LABEL: Record<string, string> = {
  personal: 'Personal',
  team: 'Team',
  workspace: 'Workspace',
};

export default async function FlowsPage() {
  let items: FlowRow[] = [];
  let loadError: string | null = null;
  try {
    const r = await apiFetch<{ items: FlowRow[] }>('/api/v1/flow/flows');
    items = r.items;
  } catch {
    loadError = 'Could not load flows.';
  }

  return (
    <div className="px-6 py-8 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Flows</h1>
          <p className="mt-1 text-sm text-ink-muted">
            State machines your contacts move through. Each step is held by gate tasks.
          </p>
        </div>
        <NewFlowButton />
      </div>

      {loadError && (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {!loadError && items.length === 0 && <EmptyState />}

      {items.length > 0 && (
        <div className="mt-8 space-y-2">
          {items.map((f) => (
            <Link
              key={f.id}
              href={`/flows/${f.id}`}
              className="flex items-center gap-4 rounded-lg border border-line bg-white px-5 py-4 hover:border-line-strong transition-colors"
            >
              <Workflow size={20} strokeWidth={1.75} className="text-ink-muted shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{f.name}</span>
                  <span
                    className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      LIFECYCLE_STYLE[f.lifecycle] ?? ''
                    }`}
                  >
                    {f.lifecycle}
                  </span>
                </div>
                {f.description && (
                  <p className="mt-0.5 text-sm text-ink-subtle truncate">{f.description}</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xs text-ink-muted">{SCOPE_LABEL[f.scope]}</div>
                <div className="text-xs text-ink-subtle mt-0.5">
                  {f.active_run_count} active
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-8 rounded-lg border border-line bg-white p-12 text-center">
      <Workflow size={32} strokeWidth={1.5} className="mx-auto text-ink-muted" />
      <h2 className="mt-4 text-lg font-medium">No flows yet</h2>
      <p className="mt-1 text-sm text-ink-subtle max-w-md mx-auto leading-relaxed">
        A flow is a sequence of steps with gate tasks. Create one, define its
        graph, and start moving contacts through it.
      </p>
      <div className="mt-5 flex justify-center">
        <NewFlowButton />
      </div>
    </div>
  );
}
