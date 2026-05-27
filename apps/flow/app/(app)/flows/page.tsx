import { Workflow } from 'lucide-react';

export const metadata = { title: 'Flows — Fibre Flow' };

export default function FlowsPage() {
  return (
    <div className="px-6 py-8 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium tracking-tight">Flows</h1>
      </div>

      <EmptyState />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-8 rounded-lg border border-line bg-white p-12 text-center">
      <Workflow size={32} strokeWidth={1.5} className="mx-auto text-ink-muted" />
      <h2 className="mt-4 text-lg font-medium">No flows yet</h2>
      <p className="mt-1 text-sm text-ink-subtle max-w-md mx-auto leading-relaxed">
        A flow is a sequence of steps with gate tasks. People move through it,
        held at each step until specific tasks are done.
      </p>
      <p className="mt-4 text-xs text-ink-muted">
        Flow creation lands in Phase C. The schema is live; the builder is next.
      </p>
    </div>
  );
}
