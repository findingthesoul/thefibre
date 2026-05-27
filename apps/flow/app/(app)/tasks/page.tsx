import { CheckSquare } from 'lucide-react';

export const metadata = { title: 'Tasks — Fibre Flow' };

export default function TasksPage() {
  return (
    <div className="px-6 py-8 max-w-5xl">
      <h1 className="text-2xl font-medium tracking-tight">My tasks</h1>

      <div className="mt-8 rounded-lg border border-line bg-white p-12 text-center">
        <CheckSquare size={32} strokeWidth={1.5} className="mx-auto text-ink-muted" />
        <h2 className="mt-4 text-lg font-medium">No tasks yet</h2>
        <p className="mt-1 text-sm text-ink-subtle max-w-md mx-auto leading-relaxed">
          Tasks come from two places: gate tasks on flow transitions, and
          manual to-dos you add yourself. Both land here once Phase D ships.
        </p>
      </div>
    </div>
  );
}
