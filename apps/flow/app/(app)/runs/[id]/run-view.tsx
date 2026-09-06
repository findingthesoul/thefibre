'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  Lock,
  AlertCircle,
  User,
  Users,
  UserCheck,
  LogOut,
} from 'lucide-react';
import { completeTask, reopenTask, transitionRun, withdrawRun } from '../../flows/actions';
import {
  one,
  runSubjectName,
  isPulseRun,
  type RunPerson as Person,
  type RunOrganisation,
} from '@/lib/run-subject';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';
type Task = {
  id: string;
  title: string;
  description: string | null;
  actor_type: string;
  status: string;
  due_at: string | null;
  gate_task_id: string | null;
  step_default_task_id: string | null;
  contact_id: string | null;
};
type Transition = {
  id: string;
  label: string;
  gate_logic: string;
  to_step: { key: string; name: string; kind: string } | null;
  gate_satisfied: boolean;
  gate_task_count: number;
};
type Detail = {
  run: {
    id: string;
    flow_id: string;
    status: string;
    withdrawn_reason: string | null;
    person: Person | Person[] | null;
    organisation?: RunOrganisation | RunOrganisation[] | null;
    subject_label?: string | null;
    source_app?: string | null;
    step: { id: string; key: string; name: string; kind: string; description: string | null } | null;
  };
  tasks: Task[];
  transitions: Transition[];
};

const ACTOR_ICON = { personal: User, team: Users, contact: UserCheck } as const;
const ACTOR_LABEL_KEY: Record<string, UiKey> = {
  personal: 'actor_you',
  team: 'actor_team',
  contact: 'actor_contact',
};
const STATUS_KEY: Record<string, UiKey> = {
  active: 'status_active',
  completed: 'status_completed',
  withdrawn: 'status_withdrawn',
};

export function RunView({ detail, locale }: { detail: Detail; locale: Locale }) {
  const router = useRouter();
  const { run, tasks, transitions } = detail;
  const person = one(run.person);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overrideFor, setOverrideFor] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState('');

  const openTasks = tasks.filter((t) => t.status === 'open' || t.status === 'in_progress');
  const doneTasks = tasks.filter((t) => t.status === 'done');
  const isTerminal = run.status !== 'active';

  async function onToggleTask(t: Task) {
    setBusy(true);
    setError(null);
    const res = t.status === 'done' ? await reopenTask(t.id, run.id) : await completeTask(t.id, run.id);
    setBusy(false);
    if (res.error) setError(res.error);
    else router.refresh();
  }

  async function onTransition(tr: Transition, override?: string) {
    setBusy(true);
    setError(null);
    const res = await transitionRun(run.id, tr.id, override ?? null);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setOverrideFor(null);
    setOverrideReason('');
    router.refresh();
  }

  async function onWithdraw() {
    if (!confirm(t(locale, 'withdraw_confirm_q'))) return;
    setBusy(true);
    setError(null);
    const res = await withdrawRun(run.id);
    setBusy(false);
    if (res.error) setError(res.error);
    else router.refresh();
  }

  return (
    <div className="mt-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-medium tracking-tight">{runSubjectName(run)}</h1>
            {isPulseRun(run) && (
              <span
                title={t(locale, 'pulse_badge_title')}
                className="bg-yellow-100 text-ink text-[10px] rounded-full px-1.5 py-0.5 shrink-0"
              >
                Pulse
              </span>
            )}
          </div>
          {person?.email && <p className="text-sm text-ink-muted">{person.email}</p>}
        </div>
        {!isTerminal && (
          <button
            onClick={onWithdraw}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-sm text-ink-subtle hover:text-ink hover:border-line-strong disabled:opacity-60"
          >
            <LogOut size={14} strokeWidth={1.75} />
            {t(locale, 'withdraw')}
          </button>
        )}
      </div>

      {/* Current step */}
      <div className="mt-6 rounded-lg border border-line bg-white p-5">
        <div className="text-[10px] uppercase tracking-wider text-ink-muted">{t(locale, 'current_step')}</div>
        <div className="mt-1 text-lg font-medium">{run.step?.name ?? '—'}</div>
        {run.step?.description && (
          <p className="mt-1 text-sm text-ink-subtle">{run.step.description}</p>
        )}
        {isTerminal && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-sm text-ink-subtle">
            <span className="rounded bg-neutral-200 px-2 py-0.5 text-xs uppercase tracking-wider">
              {STATUS_KEY[run.status] ? t(locale, STATUS_KEY[run.status]) : run.status}
            </span>
            {run.withdrawn_reason && <span>· {run.withdrawn_reason}</span>}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span className="whitespace-pre-wrap">{error}</span>
        </div>
      )}

      {/* Tasks */}
      {!isTerminal && (
        <div className="mt-6">
          <h2 className="text-sm font-medium mb-2">{t(locale, 'tasks_at_step')}</h2>
          {openTasks.length === 0 && doneTasks.length === 0 ? (
            <div className="rounded-lg border border-line bg-white p-5 text-sm text-ink-subtle">
              {t(locale, 'no_tasks_at_step')}
            </div>
          ) : (
            <div className="space-y-1.5">
              {[...openTasks, ...doneTasks].map((task) => {
                const Icon = ACTOR_ICON[task.actor_type as keyof typeof ACTOR_ICON] ?? User;
                const done = task.status === 'done';
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-lg border border-line bg-white px-4 py-3"
                  >
                    <button onClick={() => onToggleTask(task)} disabled={busy} className="shrink-0">
                      {done ? (
                        <CheckCircle2 size={20} className="text-emerald-600" />
                      ) : (
                        <Circle size={20} className="text-ink-muted hover:text-ink" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-medium ${done ? 'line-through text-ink-muted' : ''}`}>
                        {task.title}
                      </div>
                      {task.description && <div className="text-xs text-ink-muted">{task.description}</div>}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
                      <Icon size={13} strokeWidth={1.75} />
                      {t(locale, ACTOR_LABEL_KEY[task.actor_type] ?? 'actor_you')}
                    </span>
                    {task.gate_task_id && (
                      <span className="text-[10px] uppercase tracking-wider text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">
                        {t(locale, 'gate_badge')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Transitions */}
      {!isTerminal && transitions.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-medium mb-2">{t(locale, 'move_to_next_step')}</h2>
          <div className="space-y-1.5">
            {transitions.map((tr) => (
              <div key={tr.id} className="rounded-lg border border-line bg-white">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{tr.label}</div>
                    <div className="text-xs text-ink-muted">
                      → {tr.to_step?.name}
                      {tr.gate_task_count > 0 && (
                        <span>
                          {' '}
                          ·{' '}
                          {tr.gate_task_count === 1
                            ? t(locale, 'gate_summary_all_one')
                            : tr.gate_logic === 'any'
                              ? t(locale, 'gate_summary_any_many', { n: tr.gate_task_count })
                              : t(locale, 'gate_summary_all_many', { n: tr.gate_task_count })}
                        </span>
                      )}
                    </div>
                  </div>
                  {tr.gate_satisfied ? (
                    <button
                      onClick={() => onTransition(tr)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 text-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-800 disabled:opacity-60"
                    >
                      {t(locale, 'move')} <ArrowRight size={14} />
                    </button>
                  ) : (
                    <button
                      onClick={() => setOverrideFor(overrideFor === tr.id ? null : tr.id)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-ink-subtle hover:text-ink disabled:opacity-60"
                    >
                      <Lock size={14} /> {t(locale, 'override')}
                    </button>
                  )}
                </div>
                {overrideFor === tr.id && (
                  <div className="border-t border-line px-4 py-3 bg-surface-sunken/40">
                    <label className="block text-xs text-ink-muted mb-1">
                      {t(locale, 'gate_reason_label')}
                    </label>
                    <div className="flex gap-2">
                      <input
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder={t(locale, 'override_example_ph')}
                        className="flex-1 rounded-md border border-line px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
                      />
                      <button
                        onClick={() => onTransition(tr, overrideReason || 'override')}
                        disabled={busy}
                        className="rounded-md bg-neutral-900 text-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-800 disabled:opacity-60"
                      >
                        {t(locale, 'move_anyway')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
