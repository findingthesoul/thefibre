import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { FlowEditor } from './editor';
import { FlowCanvas } from './flow-canvas';
import { FlowTabs } from './flow-tabs';
import { RunsPanel, type Run, type Step } from './runs-panel';

type Graph = {
  steps: unknown[];
  transitions: unknown[];
  step_default_tasks: unknown[];
};

type FlowDetail = {
  flow: {
    id: string;
    name: string;
    description: string | null;
    scope: string;
    lifecycle: 'draft' | 'active' | 'closed' | 'archived';
    current_version_id: string | null;
  };
  version: { id: string; version_number: number; published_at: string | null } | null;
  is_draft: boolean;
  graph: Graph;
};

export default async function FlowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let detail: FlowDetail;
  try {
    detail = await apiFetch<FlowDetail>(`/api/v1/flow/flows/${id}`);
  } catch {
    notFound();
  }

  const { flow, version, is_draft, graph } = detail;

  // Runs in this flow (best-effort — empty if the flow isn't published yet).
  let runs: Run[] = [];
  try {
    const r = await apiFetch<{ items: Run[] }>(`/api/v1/flow/flows/${id}/runs`);
    runs = r.items;
  } catch {
    runs = [];
  }
  const canAddContacts = !!flow.current_version_id && flow.lifecycle === 'active';

  return (
    <div className="px-6 py-8 max-w-4xl">
      <Link
        href="/flows"
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft size={16} /> Flows
      </Link>

      <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">{flow.name}</h1>
          {flow.description && (
            <p className="mt-1 text-sm text-ink-muted max-w-2xl">{flow.description}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs text-ink-muted">
            <span className="capitalize">{flow.scope}</span>
            <span>·</span>
            <span className="capitalize">{flow.lifecycle}</span>
            {version && (
              <>
                <span>·</span>
                <span>
                  v{version.version_number}
                  {is_draft ? ' (draft)' : ''}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <FlowTabs
        flowCount={runs.length}
        builder={
          <div className="mt-4 space-y-6">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <FlowCanvas flowId={flow.id} lifecycle={flow.lifecycle} initialGraph={graph as any} />
            <details className="group">
              <summary className="cursor-pointer text-sm text-ink-muted hover:text-ink select-none">
                Advanced — edit graph as JSON
              </summary>
              <div className="mt-2">
                <FlowEditor flowId={flow.id} lifecycle={flow.lifecycle} initialGraph={graph} />
              </div>
            </details>
          </div>
        }
        flows={
          <div className="mt-2">
            <RunsPanel
              flowId={flow.id}
              runs={runs}
              steps={(graph.steps ?? []) as Step[]}
              canAdd={canAddContacts}
            />
          </div>
        }
      />
    </div>
  );
}
