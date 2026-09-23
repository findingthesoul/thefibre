'use client';

// The thread's To do list, in a popup off the thread header.
//
// Sjoerd, 2026-09-23: *"In a thread, there should be a to do list button...
// so organisisers and hosts can see what needs to happen."*
//
// SHARED, and the panel says so out loud (todo_shared_hint). It is easy to
// mistake this for the personal To do panel in the topbar, which is the same
// words for a different promise: that one is private to one person and this
// one is the thread's, visible to everyone who can open it. Assignment here
// is a label saying who is expected to act — never a permission.
//
// Ticking a row that is assigned to somebody also moves it on THEIR personal
// list, because the platform composes this table as a source
// (apps/api/src/routes/my-tasks.ts). One truth, in one place.

import { useCallback, useEffect, useState, useTransition } from 'react';
import { CheckCircle2, Circle, ListPlus, Loader2, Plus, Trash2 } from 'lucide-react';
import { INTL_LOCALES, type Locale } from '@thefibre/shared';
import { t } from '@/lib/i18n-ui';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { FormError } from '@/components/ui/form-error';
import { FIELD_INPUT_CLASS } from '@thefibre/shared/ui/fields';
import type { WorkspaceMember } from '@/lib/thread-types';
import {
  addThreadTask,
  applyTodoTemplate,
  listThreadTasks,
  listTodoTemplates,
  patchThreadTask,
  removeThreadTask,
  type ThreadTask,
  type TodoTemplate,
} from './tasks-actions';

/** 'YYYY-MM-DD' → 'Sat 31 Oct'. The row printed the raw ISO string until it
 *  was looked at on a screen — an internal format shown to a person, the same
 *  thing v0.110.0 fixed when a to-do read "fibre-sales". Intl throws on an
 *  invalid date and a throw here takes the whole panel down, so a date it
 *  cannot parse is shown as it came. */
function fmtDue(locale: Locale, iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d);
}

export function ThreadTasksPanel({
  locale,
  open,
  onClose,
  threadId,
  workspaceMembers,
  onCountChange,
}: {
  locale: Locale;
  open: boolean;
  onClose: () => void;
  threadId: string;
  workspaceMembers: WorkspaceMember[];
  /** So the header badge can follow the list without a page refresh. */
  onCountChange?: (openCount: number) => void;
}) {
  const [items, setItems] = useState<ThreadTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState<string>('');
  const [templates, setTemplates] = useState<TodoTemplate[] | null>(null);
  /** Bumped after each add, to remount the uncontrolled date field empty. */
  const [resetKey, setResetKey] = useState(0);
  const [pending, start] = useTransition();

  const load = useCallback(async () => {
    const r = await listThreadTasks(threadId);
    // An error is NOT an empty list — drawing the empty state over a list
    // that failed to load is the bug this app keeps rediscovering.
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError(null);
    setItems(r.data.items);
    onCountChange?.(r.data.open_count);
  }, [threadId, onCountChange]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  function add() {
    const text = title.trim();
    if (!text) return;
    start(async () => {
      const r = await addThreadTask(threadId, { title: text, due_on: due || null });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setTitle('');
      setDue('');
      setResetKey((n) => n + 1);
      await load();
    });
  }

  function toggle(task: ThreadTask) {
    start(async () => {
      const r = await patchThreadTask(task.id, {
        status: task.status === 'done' ? 'open' : 'done',
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      await load();
    });
  }

  function assign(task: ThreadTask, userId: string) {
    start(async () => {
      const r = await patchThreadTask(task.id, { assignee_user_id: userId || null });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      await load();
    });
  }

  function remove(task: ThreadTask) {
    start(async () => {
      const r = await removeThreadTask(task.id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      await load();
    });
  }

  function insertTemplate(templateId: string) {
    if (!templateId) return;
    start(async () => {
      const r = await applyTodoTemplate(threadId, templateId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      await load();
    });
  }

  const openItems = (items ?? []).filter((i) => i.status === 'open');
  const doneItems = (items ?? []).filter((i) => i.status === 'done');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t(locale, 'todo_list')}
      description={t(locale, 'todo_shared_hint')}
      size="lg"
      footer={
        <Button type="button" variant="secondary" onClick={onClose}>
          {t(locale, 'close')}
        </Button>
      }
    >
      {/* Add a line. Enter commits — a checklist is typed fast or not at all. */}
      <div className="flex items-end gap-2">
        {/* The width lives on the wrapper: FIELD_INPUT_CLASS already sets
            w-full, and a second width utility beside it is a coin toss on
            stylesheet order (it went the wrong way in the template editor). */}
        <div className="min-w-0 flex-1">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder={t(locale, 'todo_add_placeholder')}
            className={FIELD_INPUT_CLASS}
            aria-label={t(locale, 'todo_add_placeholder')}
          />
        </div>
        {/* DateField is uncontrolled by design (shared component), so it is
            remounted by key to clear after each add rather than growing a
            controlled variant of it here. */}
        <div className="w-44 shrink-0">
          <DateField
            key={`due-${resetKey}`}
            label={t(locale, 'todo_due')}
            name="thread-task-due"
            defaultValue={due || null}
            onValueChange={setDue}
            compact
          />
        </div>
        <Button type="button" onClick={add} disabled={pending || !title.trim()} leading={<Plus size={14} />}>
          {t(locale, 'add')}
        </Button>
      </div>

      {error && (
        <div className="mt-3">
          <FormError message={error} />
        </div>
      )}

      {items === null && !error ? (
        <div className="mt-6 flex justify-center py-8 text-ink-muted">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : (
        <>
          {openItems.length === 0 && doneItems.length === 0 && !error && (
            <div className="mt-6 rounded-lg border border-line bg-surface-sunken px-4 py-8 text-center">
              <div className="text-sm font-medium">{t(locale, 'todo_empty')}</div>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-ink-subtle">
                {t(locale, 'todo_empty_desc')}
              </p>
            </div>
          )}

          {openItems.length > 0 && (
            <ul className="mt-5 divide-y divide-line border-y border-line">
              {openItems.map((task) => (
                <Row
                  key={task.id}
                  locale={locale}
                  task={task}
                  members={workspaceMembers}
                  pending={pending}
                  onToggle={() => toggle(task)}
                  onAssign={(u) => assign(task, u)}
                  onRemove={() => remove(task)}
                />
              ))}
            </ul>
          )}

          {doneItems.length > 0 && (
            <div className="mt-6">
              <div className="text-[10px] uppercase tracking-wider text-ink-muted">
                {t(locale, 'todo_done_section')}
              </div>
              <ul className="mt-2 divide-y divide-line border-y border-line">
                {doneItems.map((task) => (
                  <Row
                    key={task.id}
                    locale={locale}
                    task={task}
                    members={workspaceMembers}
                    pending={pending}
                    onToggle={() => toggle(task)}
                    onAssign={(u) => assign(task, u)}
                    onRemove={() => remove(task)}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Insert a saved list. Loaded on first open of the picker rather than
          with the panel — most visits never touch it. */}
      <div className="mt-6 flex items-center gap-2 border-t border-line pt-4">
        <ListPlus size={15} strokeWidth={1.75} className="text-ink-muted shrink-0" />
        <select
          defaultValue=""
          disabled={pending}
          onFocus={() => {
            if (templates === null) {
              void listTodoTemplates().then((r) => setTemplates(r.ok ? r.data : []));
            }
          }}
          onChange={(e) => {
            insertTemplate(e.target.value);
            e.target.value = '';
          }}
          className={`${FIELD_INPUT_CLASS} max-w-xs`}
          aria-label={t(locale, 'todo_insert_template')}
        >
          <option value="">{t(locale, 'todo_insert_template')}</option>
          {(templates ?? []).map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.title}
            </option>
          ))}
          {templates !== null && templates.length === 0 && (
            <option value="" disabled>
              {t(locale, 'todo_no_templates')}
            </option>
          )}
        </select>
      </div>
    </Dialog>
  );
}

function Row({
  locale,
  task,
  members,
  pending,
  onToggle,
  onAssign,
  onRemove,
}: {
  locale: Locale;
  task: ThreadTask;
  members: WorkspaceMember[];
  pending: boolean;
  onToggle: () => void;
  onAssign: (userId: string) => void;
  onRemove: () => void;
}) {
  const done = task.status === 'done';
  return (
    <li className="flex items-center gap-3 py-2.5">
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        className="shrink-0 text-ink-muted hover:text-ink"
        aria-label={task.title}
        aria-pressed={done}
      >
        {done ? (
          <CheckCircle2 size={18} strokeWidth={1.75} className="text-ink-subtle" />
        ) : (
          <Circle size={18} strokeWidth={1.75} />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className={`text-sm ${done ? 'text-ink-muted line-through' : ''}`}>{task.title}</div>
        {task.due_on && (
          <div className="text-xs text-ink-muted tabular-nums">{fmtDue(locale, task.due_on)}</div>
        )}
      </div>

      {/* Who is expected to do it. A label — everyone still sees the row. */}
      <select
        value={task.assignee_user_id ?? ''}
        disabled={pending}
        onChange={(e) => onAssign(e.target.value)}
        className="shrink-0 max-w-[10rem] rounded-md border border-line bg-surface-raised px-2 py-1 text-xs text-ink-subtle focus:outline-none"
        aria-label={t(locale, 'todo_assignee_aria')}
      >
        <option value="">{t(locale, 'todo_anyone')}</option>
        {members.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {m.full_name || m.email}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={onRemove}
        disabled={pending}
        className="shrink-0 text-ink-muted hover:text-ink"
        aria-label={t(locale, 'remove')}
        title={t(locale, 'remove')}
      >
        <Trash2 size={15} strokeWidth={1.75} />
      </button>
    </li>
  );
}
