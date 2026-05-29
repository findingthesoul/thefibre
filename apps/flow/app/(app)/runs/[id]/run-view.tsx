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

type Person = { id: string; first_name: string | null; last_name: string | null; email: string | null };
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
    step: { id: string; key: string; name: string; kind: string; description: string | null } | null;
  };
  tasks: Task[];
  transitions: Transition[];
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v;
}
function personName(p: Person | null): string {
  if (!p) return 'Unknown';
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Unknown';
}

const ACTOR_ICON = { personal: User, team: Users, contact: UserCheck } as const;
const ACTOR_LABEL = { personal: 'You', team: 'Team', contact: 'Contact' } as const;

export function RunView({ detail }: { detail: Detail }) {
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
    if (!confirm('Withdraw this contact from the flow? Open tasks will be cancelled.')) return;
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
          <h1 className="text-2xl font-medium tracking-tight">{personName(person)}</h1>
          {person?.email && <p className="text-sm text-ink-muted">{person.email}</p>}
        </div>
        {!isTerminal && (
          <button
            onClick={onWithdraw}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-sm text-ink-subtle hover:text-ink hover:border-line-strong disabled:opacity-60"
          >
            <LogOut size={14} strokeWidth={1.75} />
            Withdraw
          </button>
        )}
      </div>

      {/* Current step */}
      <div className="mt-6 rounded-lg border border-line bg-white p-5">
        <div className="text-[10px] uppercase tracking-wider text-ink-muted">Current step</div>
        <div className="mt-1 text-lg font-medium">{run.step?.name ?? '—'}</div>
        {run.step?.description && (
          <p className="mt-1 text-sm text-ink-subtle">{run.step.description}</p>
        )}
        {isTerminal && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-sm text-ink-subtle">
            <span className="rounded bg-neutral-200 px-2 py-0.5 text-xs uppercase tracking-wider">
              {run.status}
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
          <h2 className="text-sm font-medium mb-2">Tasks at this step</h2>
          {openTasks.length === 0 && doneTasks.length === 0 ? (
            <div className="rounded-lg border border-line bg-white p-5 text-sm text-ink-subtle">
              No tasks at this step — you can move on freely.
            </div>
          ) : (
            <div className="space-y-1.5">
              {[...openTasks, ...doneTasks].map((t) => {
                const Icon = ACTOR_ICON[t.actor_type as keyof typeof ACTOR_ICON] ?? User;
                const done = t.status === 'done';
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-lg border border-line bg-white px-4 py-3"
                  >
                    <button onClick={() => onToggleTask(t)} disabled={busy} className="shrink-0">
                      {done ? (
                        <CheckCircle2 size={20} className="text-emerald-600" />
                      ) : (
                        <Circle size={20} className="text-ink-muted hover:text-ink" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-medium ${done ? 'line-through text-ink-muted' : ''}`}>
                        {t.title}
                      </div>
                      {t.description && <div className="text-xs text-ink-muted">{t.description}</div>}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
                      <Icon size={13} strokeWidth={1.75} />
                      {ACTOR_LABEL[t.actor_type as keyof typeof ACTOR_LABEL]}
                    </span>
                    {t.gate_task_id && (
                      <span className="text-[10px] uppercase tracking-wider text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">
                        gate
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
          <h2 className="text-sm font-medium mb-2">Move to next step</h2>
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
                          · gate: {tr.gate_logic === 'any' ? 'any of' : 'all of'} {tr.gate_task_count} task
                          {tr.gate_task_count > 1 ? 's' : ''}
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
                      Move <ArrowRight size={14} />
                    </button>
                  ) : (
                    <button
                      onClick={() => setOverrideFor(overrideFor === tr.id ? null : tr.id)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-ink-subtle hover:text-ink disabled:opacity-60"
                    >
                      <Lock size={14} /> Override
                    </button>
                  )}
                </div>
                {overrideFor === tr.id && (
                  <div className="border-t border-line px-4 py-3 bg-surface-sunken/40">
                    <label className="block text-xs text-ink-muted mb-1">
                      Gate not satisfied. Give a reason to move anyway:
                    </label>
                    <div className="flex gap-2">
                      <input
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder="e.g. verified out-of-band"
                        className="flex-1 rounded-md border border-line px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
                      />
                      <button
                        onClick={() => onTransition(tr, overrideReason || 'override')}
                        disabled={busy}
                        className="rounded-md bg-neutral-900 text-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-800 disabled:opacity-60"
                      >
                        Move anyway
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
