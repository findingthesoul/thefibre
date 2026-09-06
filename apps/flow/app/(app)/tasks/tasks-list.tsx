'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Users, UserCheck, CheckCircle2, Circle, Plus, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { createManualTask, setTaskStatus } from '../flows/actions';
import { one, type RunOrganisation } from '@/lib/run-subject';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';

type TaskRun = {
  subject_label: string | null;
  source_app: string | null;
  organisation: RunOrganisation | RunOrganisation[] | null;
};

export type Task = {
  id: string;
  title: string;
  actor_type: string;
  status: string;
  due_at: string | null;
  flow_run_id: string | null;
  contact: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null;
  run?: TaskRun | TaskRun[] | null;
};

const ACTOR_ICON = { personal: User, team: Users, contact: UserCheck } as const;

export function TasksList({ initial, locale }: { initial: Task[]; locale: Locale }) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initial);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    const trimmed = title.trim();
    if (!trimmed) return;
    setBusy(true);
    setTitle('');
    const res = await createManualTask({ title: trimmed });
    setBusy(false);
    if (!res.error) router.refresh();
  }

  async function toggle(task: Task) {
    const done = task.status === 'done';
    // optimistic
    setTasks((ts) =>
      ts.map((x) => (x.id === task.id ? { ...x, status: done ? 'open' : 'done' } : x)),
    );
    const res = await setTaskStatus(task.id, done ? 'open' : 'done');
    if (res.error) {
      setTasks((ts) => ts.map((x) => (x.id === task.id ? { ...x, status: task.status } : x)));
    } else {
      router.refresh();
    }
  }

  return (
    <div className="mt-6">
      {/* quick add */}
      <div className="flex items-center gap-2 rounded-2xl bg-white ring-1 ring-black/5 shadow-card px-4 py-2.5">
        <Plus size={16} className="text-ink-muted shrink-0" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
          }}
          placeholder={t(locale, 'add_task_ph')}
          className="flex-1 bg-transparent text-sm focus:outline-none"
        />
        {title.trim() && (
          <button
            onClick={add}
            disabled={busy}
            className="rounded-md bg-neutral-900 text-white px-3 py-1 text-xs font-medium hover:bg-neutral-800 disabled:opacity-60"
          >
            {t(locale, 'add')}
          </button>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="mt-8 rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-12 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 size={22} strokeWidth={1.5} className="text-emerald-600" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight">{t(locale, 'nothing_on_plate')}</h2>
          <p className="mt-1 text-sm text-ink-subtle max-w-md mx-auto">
            {t(locale, 'tasks_empty_blurb')}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-1.5">
          {tasks.map((task) => {
            const Icon = ACTOR_ICON[task.actor_type as keyof typeof ACTOR_ICON] ?? User;
            const contact = one(task.contact);
            const run = one(task.run ?? null);
            // Subject fallback chain: person → organisation → subject_label.
            const contactName =
              (contact ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') : '') ||
              one(run?.organisation ?? null)?.name ||
              run?.subject_label ||
              null;
            const done = task.status === 'done';
            return (
              <div
                key={task.id}
                className="flex items-center gap-3 rounded-xl bg-white ring-1 ring-black/5 shadow-card px-4 py-3"
              >
                <button
                  onClick={() => toggle(task)}
                  className="shrink-0"
                  title={done ? t(locale, 'reopen') : t(locale, 'mark_done')}
                >
                  {done ? (
                    <CheckCircle2 size={18} className="text-emerald-600" />
                  ) : (
                    <Circle size={18} className="text-ink-muted hover:text-ink" />
                  )}
                </button>
                <Icon size={16} strokeWidth={1.75} className="text-ink-muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium truncate ${done ? 'line-through text-ink-muted' : ''}`}>
                    {task.title}
                  </div>
                  {contactName && (
                    <div className="text-xs text-ink-muted">{t(locale, 're_contact', { name: contactName })}</div>
                  )}
                </div>
                {task.due_at && (
                  <div className="text-xs text-ink-muted shrink-0">
                    {new Date(task.due_at).toLocaleDateString(INTL_LOCALES[locale])}
                  </div>
                )}
                {task.flow_run_id && (
                  <Link
                    href={`/runs/${task.flow_run_id}`}
                    className="text-ink-muted hover:text-ink shrink-0"
                    title={t(locale, 'open_flow_run')}
                  >
                    <ExternalLink size={15} />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
