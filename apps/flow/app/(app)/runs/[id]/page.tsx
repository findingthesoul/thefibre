import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { RunView } from './run-view';

type Person = { id: string; first_name: string | null; last_name: string | null; email: string | null };

type RunDetail = {
  run: {
    id: string;
    flow_id: string;
    status: string;
    entered_at: string;
    current_step_entered_at: string;
    withdrawn_reason: string | null;
    person: Person | Person[] | null;
    step: { id: string; key: string; name: string; kind: string; description: string | null } | null;
  };
  tasks: {
    id: string;
    title: string;
    description: string | null;
    actor_type: string;
    status: string;
    due_at: string | null;
    gate_task_id: string | null;
    step_default_task_id: string | null;
    contact_id: string | null;
  }[];
  transitions: {
    id: string;
    label: string;
    gate_logic: string;
    to_step: { key: string; name: string; kind: string } | null;
    gate_satisfied: boolean;
    gate_task_count: number;
  }[];
};

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let detail: RunDetail;
  try {
    detail = await apiFetch<RunDetail>(`/api/v1/flow/runs/${id}`);
  } catch {
    notFound();
  }

  return (
    <div className="px-6 py-8 max-w-3xl">
      <Link
        href={`/flows/${detail.run.flow_id}`}
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft size={16} /> Back to flow
      </Link>
      <RunView detail={detail} />
    </div>
  );
}
