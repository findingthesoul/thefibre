import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { FlowEditor } from './editor';
import { FlowDiagram } from './flow-diagram';
import { RunsPanel, type Run } from './runs-panel';

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

      <div className="mt-8">
        <h2 className="text-sm font-medium mb-2">Diagram</h2>
        <FlowDiagram
          graph={graph as { steps: { key: string; name: string; kind: string }[]; transitions: { from: string; to: string; label: string; gate_logic: string; gate_tasks?: { title: string; actor_type: string }[] }[] }}
        />
      </div>

      <RunsPanel flowId={flow.id} runs={runs} canAdd={canAddContacts} />

      <FlowEditor
        flowId={flow.id}
        lifecycle={flow.lifecycle}
        initialGraph={graph}
      />
    </div>
  );
}
