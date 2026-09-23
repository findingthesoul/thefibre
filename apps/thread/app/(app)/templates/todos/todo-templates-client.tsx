'use client';

// Templates → To-do lists. A checklist you build once and drop onto any
// thread (Sjoerd, 2026-09-23: "templates needs a third group: to do's, with
// a list").
//
// Each item is a title plus an offset in DAYS from the thread's start, not a
// date — a template is reusable, so its timing has to be relative. Applying
// it rebases every offset onto the thread it lands on.

import { useState, useTransition } from 'react';
import { GripVertical, ListTodo, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Locale } from '@thefibre/shared';
import { t } from '@/lib/i18n-ui';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TextField, SelectField } from '@/components/ui/field';
import { FormError } from '@/components/ui/form-error';
import { DangerConfirmDialog } from '@/components/ui/danger-confirm';
import { FIELD_INPUT_CLASS } from '@thefibre/shared/ui/fields';
import {
  createTodoTemplate,
  deleteTodoTemplate,
  reloadTodoTemplates,
  updateTodoTemplate,
  type TodoTemplateItem,
  type TodoTemplateRow,
} from './todo-actions';

export type { TodoTemplateRow };

type Draft = {
  id: string | null;
  title: string;
  scope: 'personal' | 'team' | 'workspace';
  tasks: TodoTemplateItem[];
};

const BLANK: Draft = { id: null, title: '', scope: 'personal', tasks: [{ title: '', day_offset: null, link: null }] };

export function TodoTemplatesClient({
  locale,
  initial,
  loadError,
}: {
  locale: Locale;
  initial: TodoTemplateRow[];
  loadError: string | null;
}) {
  const [rows, setRows] = useState(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TodoTemplateRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Which row is being dragged, by index. Native HTML5 drag — the same
   *  shape Members' tier list uses, no library. */
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [pending, start] = useTransition();

  /** Drop the dragged row ON this index. Order is the array's order, and it
   *  is written back as `position: i` on save — so a list that LOOKS right
   *  is right, which is the whole argument for dragging over typing numbers
   *  (CLAUDE.md: ordering UIs are drag-and-drop, never a numeric sort
   *  field). */
  function dropOn(target: number) {
    const from = dragIdx;
    setDragIdx(null);
    if (!draft || from === null || from === target) return;
    const tasks = [...draft.tasks];
    const [moved] = tasks.splice(from, 1);
    tasks.splice(target, 0, moved);
    setDraft({ ...draft, tasks });
  }

  function refresh() {
    start(async () => {
      const r = await reloadTodoTemplates();
      if (r.ok) setRows(r.data);
      else setError(r.error);
    });
  }

  function save() {
    if (!draft) return;
    // Drop the empty rows FIRST, then number what is left. The other order
    // numbered rows that were about to be discarded and left gaps (0, 2, 3)
    // — harmless to sorting, but the position is supposed to say "this is
    // the nth step", and a list whose steps go 0, 2, 3 is a list that has
    // stopped meaning what it says.
    const tasks = draft.tasks
      .map((task) => ({ ...task, title: task.title.trim() }))
      .filter((task) => task.title !== '')
      .map((task, i) => ({ ...task, position: i }));
    const payload = { title: draft.title.trim(), scope: draft.scope, structure: { version: 1 as const, tasks } };
    if (!payload.title) return;
    start(async () => {
      const r = draft.id
        ? await updateTodoTemplate(draft.id, payload)
        : await createTodoTemplate(payload);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setError(null);
      setDraft(null);
      refresh();
    });
  }

  function remove(row: TodoTemplateRow) {
    start(async () => {
      const r = await deleteTodoTemplate(row.id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setConfirmDelete(null);
      refresh();
    });
  }

  return (
    <>
      <div className="mt-8 flex items-center justify-end">
        <Button type="button" leading={<Plus size={14} />} onClick={() => setDraft({ ...BLANK })}>
          {t(locale, 'todo_template_new')}
        </Button>
      </div>

      {(loadError || error) && (
        <div className="mt-4">
          <FormError message={loadError ?? error ?? ''} />
        </div>
      )}

      {rows.length === 0 && !loadError ? (
        <div className="mt-6 rounded-lg border border-line bg-surface-sunken px-4 py-12 text-center">
          <ListTodo size={22} strokeWidth={1.5} className="mx-auto text-ink-muted" />
          <div className="mt-3 text-sm font-medium">{t(locale, 'todo_template_empty')}</div>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-ink-subtle">
            {t(locale, 'todo_template_empty_desc')}
          </p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 py-3">
              <ListTodo size={16} strokeWidth={1.75} className="shrink-0 text-ink-muted" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{row.title}</div>
                <div className="text-xs text-ink-muted">
                  {t(locale, row.scope === 'personal' ? 'personal' : row.scope === 'team' ? 'team' : 'workspace')}
                  {' · '}
                  {/* A bare number reads as "Workspace · 5" and makes the
                      reader guess what was counted. */}
                  {row.structure?.tasks?.length ?? 0}{' '}
                  {t(locale, (row.structure?.tasks?.length ?? 0) === 1 ? 'todo_step_one' : 'todo_step_many')}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leading={<Pencil size={14} />}
                onClick={() =>
                  setDraft({
                    id: row.id,
                    title: row.title,
                    scope: row.scope,
                    tasks: row.structure?.tasks?.length
                      ? row.structure.tasks.map((task) => ({ ...task }))
                      : [{ title: '', day_offset: null, link: null }],
                  })
                }
              >
                {t(locale, 'edit')}
              </Button>
              <button
                type="button"
                onClick={() => setConfirmDelete(row)}
                className="shrink-0 text-ink-muted hover:text-ink"
                aria-label={t(locale, 'delete')}
                title={t(locale, 'delete')}
              >
                <Trash2 size={15} strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? draft.title || t(locale, 'todo_templates') : t(locale, 'todo_template_new')}
        size="lg"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setDraft(null)}>
              {t(locale, 'cancel')}
            </Button>
            <Button type="button" variant="save" onClick={save} disabled={pending || !draft?.title.trim()}>
              {t(locale, 'save')}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-5">
            <TextField
              label={t(locale, 'todo_template_name')}
              name="todo-template-title"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            <SelectField
              label={t(locale, 'scope')}
              name="todo-template-scope"
              value={draft.scope}
              onChange={(e) => setDraft({ ...draft, scope: e.target.value as Draft['scope'] })}
              options={[
                { value: 'personal', label: t(locale, 'personal') },
                { value: 'team', label: t(locale, 'team') },
                { value: 'workspace', label: t(locale, 'workspace') },
              ]}
            />

            <div>
              <div className="text-[10px] uppercase tracking-wider text-ink-muted">
                {t(locale, 'todo_list')}
              </div>
              <p className="mt-1 text-xs text-ink-subtle">{t(locale, 'todo_day_offset_hint')}</p>
              <p className="mt-1 text-xs text-ink-subtle">{t(locale, 'todo_link_hint')}</p>
              <ul className="mt-3 space-y-2">
                {draft.tasks.map((task, i) => (
                  // The widths live on WRAPPERS, not on the inputs.
                  // FIELD_INPUT_CLASS carries `w-full`, so putting `flex-1`
                  // or `w-24` in the same class string pits two width
                  // utilities of equal specificity against each other and
                  // stylesheet order decides the winner. It decided wrong:
                  // the day-offset boxes took the full row and every title
                  // collapsed to a sliver. Seen on the screen; nothing threw.
                  <li
                    key={i}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => dropOn(i)}
                    className={`flex items-start gap-2 rounded-md ${
                      dragIdx === i ? 'opacity-50' : ''
                    }`}
                  >
                    {/* Only the handle is draggable, not the row: a row-wide
                        drag makes the text inputs impossible to select. */}
                    <span
                      draggable
                      onDragStart={() => setDragIdx(i)}
                      onDragEnd={() => setDragIdx(null)}
                      title={t(locale, 'todo_reorder')}
                      aria-label={t(locale, 'todo_reorder')}
                      className="mt-2.5 shrink-0 cursor-grab text-ink-muted hover:text-ink active:cursor-grabbing"
                    >
                      <GripVertical size={15} strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <input
                        value={task.title}
                        onChange={(e) => {
                          const tasks = [...draft.tasks];
                          tasks[i] = { ...task, title: e.target.value };
                          setDraft({ ...draft, tasks });
                        }}
                        placeholder={t(locale, 'todo_add_placeholder')}
                        className={FIELD_INPUT_CLASS}
                        aria-label={t(locale, 'todo_add_placeholder')}
                      />
                      {/* The link sits UNDER the title rather than beside it:
                          a URL is long, and a third column would have left
                          every field too narrow to read what is in it. */}
                      <input
                        value={task.link ?? ''}
                        onChange={(e) => {
                          const tasks = [...draft.tasks];
                          tasks[i] = { ...task, link: e.target.value || null };
                          setDraft({ ...draft, tasks });
                        }}
                        placeholder="https://docs.google.com/…"
                        className={`${FIELD_INPUT_CLASS} text-xs`}
                        aria-label={t(locale, 'todo_link')}
                      />
                    </div>
                    <div className="w-24 shrink-0">
                      <input
                        type="number"
                        value={task.day_offset ?? ''}
                        onChange={(e) => {
                          const tasks = [...draft.tasks];
                          tasks[i] = {
                            ...task,
                            day_offset: e.target.value === '' ? null : Number(e.target.value),
                          };
                          setDraft({ ...draft, tasks });
                        }}
                        className={`${FIELD_INPUT_CLASS} tabular-nums`}
                        aria-label={t(locale, 'todo_day_offset')}
                        title={t(locale, 'todo_day_offset')}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({ ...draft, tasks: draft.tasks.filter((_, n) => n !== i) })
                      }
                      className="mt-2.5 shrink-0 text-ink-muted hover:text-ink"
                      aria-label={t(locale, 'remove')}
                    >
                      <Trash2 size={15} strokeWidth={1.75} />
                    </button>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leading={<Plus size={14} />}
                className="mt-2"
                onClick={() =>
                  setDraft({ ...draft, tasks: [...draft.tasks, { title: '', day_offset: null, link: null }] })
                }
              >
                {t(locale, 'todo_add_item')}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <DangerConfirmDialog
        open={!!confirmDelete}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove(confirmDelete)}
        title={t(locale, 'delete')}
        message={confirmDelete?.title ?? ''}
        pending={pending}
      />
    </>
  );
}
