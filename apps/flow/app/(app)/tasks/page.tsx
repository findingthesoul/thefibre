import Link from 'next/link';
import { CheckSquare, User, Users, UserCheck } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export const metadata = { title: 'Tasks — Fibre Flow' };

type Task = {
  id: string;
  title: string;
  description: string | null;
  actor_type: string;
  status: string;
  due_at: string | null;
  flow_run_id: string | null;
  contact: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null;
};

const ACTOR_ICON = { personal: User, team: Users, contact: UserCheck } as const;

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v;
}

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
    <div className="px-6 py-8 max-w-3xl">
      <h1 className="text-2xl font-medium tracking-tight">My tasks</h1>
      <p className="mt-1 text-sm text-ink-muted">Open tasks assigned to you across all flows.</p>

      {loadError && (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {!loadError && items.length === 0 && (
        <div className="mt-8 rounded-lg border border-line bg-white p-12 text-center">
          <CheckSquare size={32} strokeWidth={1.5} className="mx-auto text-ink-muted" />
          <h2 className="mt-4 text-lg font-medium">Nothing on your plate</h2>
          <p className="mt-1 text-sm text-ink-subtle max-w-md mx-auto">
            Tasks assigned to you appear here as contacts move through flows.
          </p>
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-8 space-y-1.5">
          {items.map((t) => {
            const Icon = ACTOR_ICON[t.actor_type as keyof typeof ACTOR_ICON] ?? User;
            const contact = one(t.contact);
            const contactName = contact
              ? [contact.first_name, contact.last_name].filter(Boolean).join(' ')
              : null;
            const inner = (
              <div className="flex items-center gap-3 rounded-lg border border-line bg-white px-4 py-3 hover:border-line-strong transition-colors">
                <Icon size={18} strokeWidth={1.75} className="text-ink-muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  {contactName && <div className="text-xs text-ink-muted">re: {contactName}</div>}
                </div>
                {t.due_at && (
                  <div className="text-xs text-ink-muted shrink-0">
                    {new Date(t.due_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            );
            return t.flow_run_id ? (
              <Link key={t.id} href={`/runs/${t.flow_run_id}`}>
                {inner}
              </Link>
            ) : (
              <div key={t.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
