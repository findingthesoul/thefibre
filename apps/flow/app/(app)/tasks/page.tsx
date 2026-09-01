import { apiFetch } from '@/lib/api';
import { TasksList, type Task } from './tasks-list';

export const metadata = { title: 'Tasks — Flow' };

export default async function TasksPage() {
  let items: Task[] = [];
  let loadError: string | null = null;
  try {
    const r = await apiFetch<{ items: Task[] }>('/api/v1/flow/tasks?scope=mine&status=open');
    items = r.items;
  } catch {
    loadError = 'Could not load tasks.';
  }

  return (
    <div className="px-6 py-10 max-w-3xl">
      <h1 className="text-[28px] font-semibold tracking-tight text-ink">My tasks</h1>
      <p className="mt-1 text-sm text-ink-muted">Open tasks assigned to you across all flows.</p>

      {loadError ? (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      ) : (
        <TasksList initial={items} />
      )}
    </div>
  );
}
