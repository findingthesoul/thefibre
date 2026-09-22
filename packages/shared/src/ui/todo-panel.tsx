'use client';

// "To do" — the personal list, in a panel beside your own icon
// (Sjoerd, 2026-09-22: "A panel... maybe next to your personal ICON to toggle
// it on or off"). docs/personal-todo-proposal.md.
//
// Born shared, because every app's topbar gets the same button. What is
// app-bound — the fetching and the server actions — arrives as props, the
// ui/invoices.tsx pattern; this file holds no api client and no Next import.
//
// What it shows: your typed to-dos and the items the apps own, merged by the
// platform, grouped by the day they belong to. Ticking moves an item to the
// archive, where it can be un-ticked for seven days.

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Circle, Clock, ListTodo, Plus, RotateCcw, X } from 'lucide-react';
import { FIELD_INPUT_CLASS } from './fields.js';
import { chromeT, useLocale } from './i18n-ui.js';

export type TodoItem = {
  id: string | null;
  source: { app: string; ref: string } | null;
  title: string;
  due_on: string | null;
  app: string | null;
  subject: { kind: string; id: string | null; label: string | null } | null;
  href: string | null;
  state: 'open' | 'done' | 'snoozed';
  snoozed_until: string | null;
  done_at: string | null;
  sort: number;
};

export type TodoGroups = Record<string, TodoItem[]>;

export type TodoActions = {
  list: (view: 'open' | 'archive') => Promise<{ items: TodoItem[]; groups: TodoGroups } | null>;
  add: (title: string, dueOn: string | null) => Promise<void>;
  setState: (
    item: TodoItem,
    state: 'open' | 'done' | 'snoozed',
    snoozedUntil?: string | null,
  ) => Promise<void>;
  remove: (item: TodoItem) => Promise<void>;
};

const GROUP_ORDER = ['overdue', 'today', 'tomorrow', 'this_week', 'later', 'no_date'] as const;
const GROUP_KEY = {
  overdue: 'todo_overdue', today: 'todo_today', tomorrow: 'todo_tomorrow',
  this_week: 'todo_this_week', later: 'todo_later', no_date: 'todo_no_date',
} as const;

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

/** The button that lives beside the person's own icon, plus the panel it opens. */
export function TodoPanelButton({ actions }: { actions: TodoActions }) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'open' | 'archive'>('open');
  const [groups, setGroups] = useState<TodoGroups>({});
  const [archive, setArchive] = useState<TodoItem[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  // The caller almost always builds `actions` inline, so its identity changes
  // on every render. Holding it in a ref keeps `load` stable: depending on the
  // object itself made the effect refire forever, and the panel never settled
  // long enough to be clicked (caught on staging, 2026-09-23). Same reason
  // ui/search-select.tsx keeps loadOptions in a ref.
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const load = useCallback(
    async (which: 'open' | 'archive') => {
      const data = await actionsRef.current.list(which);
      if (!data) return;
      if (which === 'archive') setArchive(data.items);
      else {
        setGroups(data.groups);
        // The number on the button is what is due, not what exists: a list of
        // "later" items should not nag.
        setCount((data.groups.overdue?.length ?? 0) + (data.groups.today?.length ?? 0));
      }
    },
    [],
  );

  useEffect(() => {
    void load('open');
  }, [load]);

  useEffect(() => {
    if (!open) return;
    void load(view);
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open, view, load]);

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      await load(view);
      if (view === 'archive') await load('open');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={chromeT(locale, 'todo')}
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-lg ${
          open ? 'bg-surface-raised text-ink ring-1 ring-line shadow-sm' : 'text-ink-subtle hover:text-ink'
        }`}
      >
        <ListTodo size={18} strokeWidth={1.75} />
        {!!count && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-save px-1 text-[10px] font-medium leading-4 text-ink">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] rounded-lg border border-line bg-surface-raised shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-sm font-medium">{chromeT(locale, 'todo')}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setView(view === 'open' ? 'archive' : 'open')}
                className="text-xs text-ink-subtle underline underline-offset-2 hover:text-ink"
              >
                {chromeT(locale, view === 'open' ? 'todo_archive' : 'todo_back_to_list')}
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label={chromeT(locale, 'close')} className="p-1 text-ink-muted hover:text-ink">
                <X size={16} />
              </button>
            </div>
          </div>

          {view === 'open' && (
            <form
              className="flex items-center gap-2 border-b border-line px-3 py-2"
              onSubmit={(e) => {
                e.preventDefault();
                const t = title.trim();
                if (!t) return;
                setTitle('');
                void act(() => actions.add(t, null));
              }}
            >
              <Plus size={15} className="shrink-0 text-ink-muted" />
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={chromeT(locale, 'todo_add')}
                className={`${FIELD_INPUT_CLASS} h-8 border-0 bg-transparent px-0`}
              />
            </form>
          )}

          <div className="max-h-[60vh] overflow-y-auto px-3 py-2">
            {view === 'archive' ? (
              <Archive items={archive} busy={busy} onUndo={(i) => void act(() => actions.setState(i, 'open'))} />
            ) : (
              <OpenList groups={groups} busy={busy} actions={actions} act={act} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OpenList({
  groups, busy, actions, act,
}: {
  groups: TodoGroups;
  busy: boolean;
  actions: TodoActions;
  act: (fn: () => Promise<void>) => Promise<void>;
}) {
  const locale = useLocale();
  const empty = GROUP_ORDER.every((g) => !(groups[g]?.length ?? 0));
  if (empty) return <p className="py-6 text-center text-sm text-ink-muted">{chromeT(locale, 'todo_empty')}</p>;
  return (
    <>
      {GROUP_ORDER.map((g) =>
        groups[g]?.length ? (
          <div key={g} className="mb-3">
            <div className={`mb-1 text-[10px] uppercase tracking-wider ${g === 'overdue' ? 'text-red-700' : 'text-ink-muted'}`}>
              {chromeT(locale, GROUP_KEY[g])}
            </div>
            <ul className="space-y-0.5">
              {groups[g]!.map((item) => (
                <Row
                  key={item.id ?? `${item.source?.app}:${item.source?.ref}`}
                  item={item}
                  busy={busy}
                  onTick={() => void act(() => actions.setState(item, 'done'))}
                  onSnooze={(d) => void act(() => actions.setState(item, 'snoozed', d))}
                  onRemove={item.source ? undefined : () => void act(() => actions.remove(item))}
                />
              ))}
            </ul>
          </div>
        ) : null,
      )}
    </>
  );
}

function Row({
  item, busy, onTick, onSnooze, onRemove,
}: {
  item: TodoItem;
  busy: boolean;
  onTick: () => void;
  onSnooze: (dueOn: string) => void;
  onRemove?: (() => void) | undefined;
}) {
  const locale = useLocale();
  const [menu, setMenu] = useState(false);
  return (
    <li className="group flex items-start gap-2 rounded-md px-1 py-1.5 hover:bg-surface-sunken">
      <button type="button" onClick={onTick} disabled={busy} aria-label={chromeT(locale, 'todo_done')} className="mt-0.5 text-ink-muted hover:text-ink">
        <Circle size={16} />
      </button>
      <span className="min-w-0 flex-1">
        {item.href ? (
          <a href={item.href} className="block truncate text-sm hover:underline">{item.title}</a>
        ) : (
          <span className="block truncate text-sm">{item.title}</span>
        )}
        {(item.subject?.label || item.app) && (
          <span className="block truncate text-xs text-ink-muted">
            {[item.subject?.label, item.app].filter(Boolean).join(' · ')}
          </span>
        )}
      </span>
      <span className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenu((v) => !v)}
          disabled={busy}
          aria-label={chromeT(locale, 'todo_snooze')}
          className="p-1 text-ink-muted opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-ink"
        >
          <Clock size={15} />
        </button>
        {menu && (
          <span className="absolute right-0 z-10 mt-1 w-36 rounded-md border border-line bg-surface-raised py-1 shadow-lg">
            {([['todo_tomorrow', 1], ['todo_next_week', 7], ['todo_someday', 30]] as const).map(([key, days]) => (
              <button
                key={key}
                type="button"
                onClick={() => { setMenu(false); onSnooze(day(days)); }}
                className="block w-full px-3 py-1.5 text-left text-xs text-ink-subtle hover:bg-surface-sunken hover:text-ink"
              >
                {chromeT(locale, key)}
              </button>
            ))}
            {onRemove && (
              <button
                type="button"
                onClick={() => { setMenu(false); onRemove(); }}
                className="block w-full border-t border-line px-3 py-1.5 text-left text-xs text-ink-subtle hover:bg-surface-sunken hover:text-ink"
              >
                {chromeT(locale, 'remove')}
              </button>
            )}
          </span>
        )}
      </span>
    </li>
  );
}

function Archive({ items, busy, onUndo }: { items: TodoItem[]; busy: boolean; onUndo: (i: TodoItem) => void }) {
  const locale = useLocale();
  if (!items.length) return <p className="py-6 text-center text-sm text-ink-muted">{chromeT(locale, 'todo_archive_empty')}</p>;
  return (
    <ul className="space-y-0.5">
      {items.map((item) => (
        <li key={item.id ?? `${item.source?.app}:${item.source?.ref}`} className="flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-surface-sunken">
          <CheckCircle2 size={16} className="shrink-0 text-ink-muted" />
          <span className="min-w-0 flex-1 truncate text-sm text-ink-subtle line-through">{item.title}</span>
          <button type="button" onClick={() => onUndo(item)} disabled={busy} aria-label={chromeT(locale, 'todo_undo')} className="p-1 text-ink-muted hover:text-ink">
            <RotateCcw size={15} />
          </button>
        </li>
      ))}
    </ul>
  );
}
