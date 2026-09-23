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
// The dialog is xl rather than lg: every row carries a date picker and an
// assignee picker beside the title, and at lg the title column was squeezed
// to about a third of the row.
//
// Ticking a row that is assigned to somebody also moves it on THEIR personal
// list, because the platform composes this table as a source
// (apps/api/src/routes/my-tasks.ts). One truth, in one place.

import { useCallback, useEffect, useState, useTransition } from 'react';
import { CheckCircle2, Circle, Link as LinkIcon, ListPlus, Loader2, Plus, Trash2 } from 'lucide-react';
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

  /** Move a to-do to a different day. The row's own date control already
   *  shows the new value, so this saves without reloading the list — a
   *  reload here would rebuild every row under the popover that was just
   *  used, and the date would appear to flicker back before settling. */
  function changeDue(task: ThreadTask, dueOn: string | null) {
    start(async () => {
      const r = await patchThreadTask(task.id, { due_on: dueOn });
      if (!r.ok) {
        setError(r.error);
        // Only on failure is the list worth rebuilding: it puts the row back
        // to the date the server still holds, so the screen stops claiming a
        // change that did not happen.
        await load();
        return;
      }
      setItems((prev) =>
        prev ? prev.map((i) => (i.id === task.id ? { ...i, due_on: dueOn } : i)) : prev,
      );
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
      size="xl"
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
                  onDue={(d) => changeDue(task, d)}
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
                    onDue={(d) => changeDue(task, d)}
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
  onDue,
  onRemove,
}: {
  locale: Locale;
  task: ThreadTask;
  members: WorkspaceMember[];
  pending: boolean;
  onToggle: () => void;
  onAssign: (userId: string) => void;
  onDue: (dueOn: string | null) => void;
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
        <div className={`flex items-center gap-1.5 text-sm ${done ? 'text-ink-muted line-through' : ''}`}>
          <span className="truncate">{task.title}</span>
          {/* Where the work actually is. The Thread is not trying to hold the
              document — the checklist's job is to get you to it. Opens in a
              new tab, because losing the list to follow a link off it is the
              one thing a checklist must not do. */}
          {task.link_url && (
            <a
              href={task.link_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 text-ink-muted hover:text-ink"
              title={t(locale, 'todo_open_link')}
              aria-label={t(locale, 'todo_open_link')}
            >
              <LinkIcon size={13} strokeWidth={1.75} />
            </a>
          )}
        </div>
        {/* EDITABLE, because a template's dates are a suggestion.
            Sjoerd, 2026-09-23: "I should also be able to change dates... the
            dates in the template are a suggestion". A checklist laid down
            from a template is dated by arithmetic off the thread's start, and
            arithmetic does not know that the venue answers on Tuesdays. It
            was read-only text until he used it on a real thread.

            The shared DateField, not a native input (CLAUDE.md), with a
            screen-reader-only label: `sr-only` is out of flow, so the row
            keeps its height and the control still has a name. */}
        {/* w-44, not w-36: the trigger carries the date PLUS a clear X and a
            calendar icon, and at w-36 a full date truncated to "3 Oct 20…",
            which is worse than the read-only text it replaced. Matches the
            add-row's date field above. */}
        <div className="mt-0.5 w-44">
          <DateField
            label={<span className="sr-only">{t(locale, 'todo_due')}</span>}
            name={`task-due-${task.id}`}
            defaultValue={task.due_on}
            onValueChange={(v) => onDue(v || null)}
            compact
          />
        </div>
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
