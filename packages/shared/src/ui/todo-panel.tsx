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
import { CheckCircle2, Circle, Clock, ListTodo, Loader2, Plus, RotateCcw, Users, X } from 'lucide-react';
import { FIELD_INPUT_CLASS } from './fields.js';
import { TODO_GROUPS } from '../todo-groups.js';
import { APPS, appUrl } from '../branding.js';
import type { AppId } from '../index.js';
import { chromeT, useLocale } from './i18n-ui.js';

export type TodoItem = {
  id: string | null;
  source: { app: string; ref: string } | null;
  title: string;
  due_on: string | null;
  app: string | null;
  subject: { kind: string; id: string | null; label: string | null } | null;
  href: string | null;
  /** Which team it is for. A label on your own row — never a share. */
  team?: { id: string; name: string } | null;
  /** The organisation the subject belongs to. A label. */
  org?: string | null;
  /** The subject's tags — labels, never the note that produced them. */
  tags?: string[];
  /** The first line of the note behind a follow-up, for hover text. */
  note?: string | null;
  state: 'open' | 'done' | 'snoozed';
  snoozed_until: string | null;
  done_at: string | null;
  sort: number;
};

export type TodoGroups = Record<string, TodoItem[]>;

/** A team you are an active member of — the only ones you may file under. */
export type TodoTeam = { id: string; name: string };

export type TodoActions = {
  list: (
    view: 'open' | 'archive',
    team?: string,
  ) => Promise<{
    items: TodoItem[];
    groups: TodoGroups;
    teams: TodoTeam[];
    /** What you ticked today, newest first. */
    doneToday: TodoItem[];
  } | null>;
  add: (title: string, dueOn: string | null, teamId?: string | null) => Promise<void>;
  setState: (
    item: TodoItem,
    state: 'open' | 'done' | 'snoozed',
    snoozedUntil?: string | null,
  ) => Promise<void>;
  remove: (item: TodoItem) => Promise<void>;
  /** Rename one you typed. Absent = the panel shows no edit affordance. */
  rename?: (item: TodoItem, title: string) => Promise<void>;
};

// The one list, shared with the API's groupByDay — see ../todo-groups.js.
const GROUP_ORDER = TODO_GROUPS;
const GROUP_KEY = {
  overdue: 'todo_overdue', today: 'todo_today', tomorrow: 'todo_tomorrow',
  this_week: 'todo_this_week', later: 'todo_later', no_date: 'todo_no_date',
} as const;

/** The app's NAME, not its slug. The row used to print `item.app` raw, so a
 *  Connect follow-up read "fibre-sales" and a Flow task read "fibre-flow" —
 *  internal identifiers shown to a person. The registry is the single source
 *  of display names (house rule); an unknown slug falls back to itself rather
 *  than disappearing. */
function appName(slug: string | null): string | null {
  if (!slug) return null;
  const meta = (APPS as Record<string, { shortName?: string; name?: string } | undefined>)[slug];
  return meta?.shortName ?? meta?.name ?? slug;
}

/**
 * Where a row actually points.
 *
 * The API hands back an app-RELATIVE path — `/people/…`, `/threads/…`,
 * `/runs/…` — because it belongs to the app that made the item. The panel
 * lives in all seven apps, so rendering that path as-is asks the CURRENT app
 * for someone else's page: clicking a Connect follow-up from The Fibre looked
 * for thefibre.app/people/… and 404'd (Sjoerd, 2026-09-23).
 *
 * Resolved against the host we are being served from, so a panel on
 * thefibre.tech links to .tech and never sends somebody to production
 * believing they are still on staging — the rule appUrl exists to enforce.
 * Safe on the client only, which is where it runs: items arrive from an
 * effect, so none exist during a server render.
 */
function hrefFor(item: TodoItem): string | null {
  if (!item.href) return null;
  if (/^https?:\/\//i.test(item.href)) return item.href;
  const slug = item.app;
  if (!slug || !(slug in APPS)) return item.href;
  const host = typeof location === 'undefined' ? null : location.host;
  return `${appUrl(slug as AppId, undefined, host).replace(/\/$/, '')}${item.href}`;
}

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

/** The button that lives beside the person's own icon, plus the panel it opens. */
export function TodoPanelButton({
  actions,
  initialOpen = false,
  onOpenChange,
}: {
  actions: TodoActions;
  /** Whether it was open when you left the last app. Server-rendered from a
   *  domain-wide cookie, so an open panel is open on first paint. */
  initialOpen?: boolean;
  /** Persist that, so the panel survives the walk to the next app. */
  onOpenChange?: (open: boolean) => void;
}) {
  const locale = useLocale();
  const [open, setOpen] = useState(initialOpen);
  const [view, setView] = useState<'open' | 'archive'>('open');
  const [groups, setGroups] = useState<TodoGroups>({});
  const [archive, setArchive] = useState<TodoItem[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  // Distinct from `busy`: this is the list arriving, not a row changing.
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  // Which team the list is narrowed to, and which one a new item gets.
  // undefined = every team; '' = the ones under no team.
  const [teams, setTeams] = useState<TodoTeam[]>([]);
  // What you ticked today, at the foot of the list. Two by default — enough
  // to undo a mistake without turning the list into a log of the day.
  const [doneToday, setDoneToday] = useState<TodoItem[]>([]);
  const [allDone, setAllDone] = useState(false);
  const [teamFilter, setTeamFilter] = useState<string | undefined>(undefined);
  const panelRef = useRef<HTMLDivElement>(null);

  // The caller almost always builds `actions` inline, so its identity changes
  // on every render. Holding it in a ref keeps `load` stable: depending on the
  // object itself made the effect refire forever, and the panel never settled
  // long enough to be clicked (caught on staging, 2026-09-23). Same reason
  // ui/search-select.tsx keeps loadOptions in a ref.
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const load = useCallback(
    async (which: 'open' | 'archive', team?: string) => {
      setLoading(true);
      let data;
      try {
        data = await actionsRef.current.list(which, team);
      } finally {
        setLoading(false);
      }
      if (!data) return;
      setTeams(data.teams);
      setDoneToday(data.doneToday);
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
    void load('open', teamFilter);
  }, [load, teamFilter]);

  // Open and closed are both deliberate states, remembered across apps, so
  // one place does both: set the state and tell the caller to persist it.
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const setOpenPersisted = useCallback((next: boolean) => {
    setOpen(next);
    onOpenChangeRef.current?.(next);
  }, []);

  useEffect(() => {
    if (!open) return;
    void load(view, teamFilter);
    // Escape closes it; clicking elsewhere does NOT. The panel is meant to
    // stay open while you move around and between apps (Sjoerd, 2026-09-23:
    // *"the panel can also stay open, scanning through various apps"*) — and
    // an outside-click close would fire on the app switcher itself, shutting
    // the panel on the very click that walks you to the next app. It closes
    // from its own X, or from the button that opened it.
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenPersisted(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, view, teamFilter, load, setOpenPersisted]);

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      await load(view, teamFilter);
      if (view === 'archive') await load('open', teamFilter);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpenPersisted(!open)}
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
        <div
          className={
            // Full width on a phone (Sjoerd, 2026-09-23: "Mobile: to do list
            // over de full width") — fixed to the viewport rather than hung
            // off a button near the right edge, which is what made it a narrow
            // column squeezed against the side. Unchanged from `sm` up.
            'fixed inset-x-0 top-14 z-50 rounded-none border-x-0 ' +
            'sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[22rem] ' +
            'sm:max-w-[calc(100vw-1.5rem)] sm:rounded-lg sm:border-x ' +
            'border-y border-line bg-surface-raised shadow-lg'
          }
        >
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
              <button type="button" onClick={() => setOpenPersisted(false)} aria-label={chromeT(locale, 'close')} className="p-1 text-ink-muted hover:text-ink">
                <X size={16} />
              </button>
            </div>
          </div>

          {view === 'open' && teams.length > 0 && (
            <div className="flex items-center gap-2 border-b border-line px-3 py-2">
              <Users size={15} className="shrink-0 text-ink-muted" />
              <select
                value={teamFilter ?? '__all'}
                onChange={(e) => {
                  const v = e.target.value;
                  setTeamFilter(v === '__all' ? undefined : v === '__none' ? '' : v);
                }}
                aria-label={chromeT(locale, 'todo_team')}
                className={`${FIELD_INPUT_CLASS} h-8 w-full border-0 bg-transparent px-0`}
              >
                <option value="__all">{chromeT(locale, 'todo_all_teams')}</option>
                <option value="__none">{chromeT(locale, 'todo_no_team')}</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {view === 'open' && (
            <form
              className="flex items-center gap-2 border-b border-line px-3 py-2"
              onSubmit={(e) => {
                e.preventDefault();
                const t = title.trim();
                if (!t) return;
                setTitle('');
                // A new item lands in the team you are looking at — the
                // obvious intent when you have narrowed the list first.
                void act(() => actions.add(t, null, teamFilter || null));
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
            {loading ? (
              <p className="flex items-center gap-2 py-3 text-sm text-ink-subtle">
                <Loader2 size={14} className="animate-spin" />
                {chromeT(locale, 'loading')}
              </p>
            ) : view === 'archive' ? (
              <Archive items={archive} busy={busy} onUndo={(i) => void act(() => actions.setState(i, 'open'))} />
            ) : (
              <>
                <OpenList groups={groups} busy={busy} actions={actions} act={act} />
                {doneToday.length > 0 && (
                  <div className="mt-2 border-t border-line pt-2">
                    <div className="mb-1 text-[10px] uppercase tracking-wider text-ink-muted">
                      {chromeT(locale, 'todo_done_today')}
                    </div>
                    <ul className="space-y-0.5">
                      {(allDone ? doneToday : doneToday.slice(0, 2)).map((item) => (
                        <li
                          key={item.id ?? `${item.source?.app}:${item.source?.ref}`}
                          className="group flex items-start gap-2 rounded-md px-1 py-1 hover:bg-surface-sunken"
                        >
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void act(() => actions.setState(item, 'open'))}
                            aria-label={chromeT(locale, 'todo_undo')}
                            className="mt-0.5 text-ink-muted hover:text-ink"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                          <span className="min-w-0 flex-1 truncate text-sm text-ink-muted line-through">
                            {item.title}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {doneToday.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setAllDone((v) => !v)}
                        className="mt-1 px-1 text-xs text-ink-subtle underline underline-offset-2 hover:text-ink"
                      >
                        {allDone
                          ? chromeT(locale, 'todo_show_less')
                          : `${chromeT(locale, 'load_more')} (${doneToday.length - 2})`}
                      </button>
                    )}
                  </div>
                )}
              </>
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
                  onRename={
                    actions.rename && !item.source && item.id
                      ? (title) => void act(() => actions.rename!(item, title))
                      : undefined
                  }
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
  item, busy, onTick, onSnooze, onRemove, onRename,
}: {
  item: TodoItem;
  busy: boolean;
  onTick: () => void;
  onSnooze: (dueOn: string) => void;
  onRemove?: (() => void) | undefined;
  /** Absent for an app's item: its title lives in that app. */
  onRename?: ((title: string) => void) | undefined;
}) {
  const locale = useLocale();
  const [menu, setMenu] = useState(false);
  // Double-click to edit (Sjoerd, 2026-09-23). Enter or clicking away saves,
  // Escape puts it back — the three things anybody expects of an inline edit.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);

  function commit() {
    setEditing(false);
    const next = draft.trim();
    // Empty is not a rename, it is a mistake: put the old title back rather
    // than storing a row with no name (the table refuses it anyway).
    if (!next || next === item.title) {
      setDraft(item.title);
      return;
    }
    onRename?.(next);
  }
  return (
    <li className="group flex items-start gap-2 rounded-md px-1 py-1.5 hover:bg-surface-sunken">
      <button type="button" onClick={onTick} disabled={busy} aria-label={chromeT(locale, 'todo_done')} className="mt-0.5 text-ink-muted hover:text-ink">
        <Circle size={16} />
      </button>
      <span className="min-w-0 flex-1" onDoubleClick={onRename ? () => { setDraft(item.title); setEditing(true); } : undefined}>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commit(); }
              if (e.key === 'Escape') { e.preventDefault(); setDraft(item.title); setEditing(false); }
            }}
            aria-label={chromeT(locale, 'todo_edit')}
            // Size comes from FIELD_INPUT_CLASS alone: anything smaller than
            // 16px makes iOS zoom the page on focus. (Naming the small class
            // even in a comment trips the guard in ui/fields.test.ts, which
            // reads the whole tag — including this.)
            className={`${FIELD_INPUT_CLASS} h-8 w-full px-1 py-0`}
          />
        ) : hrefFor(item) ? (
          <a
            href={hrefFor(item)!}
            title={item.note ?? undefined}
            className="block truncate text-sm hover:underline"
          >
            {item.title}
          </a>
        ) : (
          <span
            className={`block truncate text-sm ${onRename ? 'cursor-text' : ''}`}
            title={onRename ? chromeT(locale, 'todo_edit_hint') : undefined}
          >
            {item.title}
          </span>
        )}
        {(item.subject?.label || item.app || item.team || item.org) && (
          // Who it is about, then where they sit, then which app it came from.
          // "Follow up" on its own said nothing (Sjoerd, 2026-09-23).
          <span
            className="block truncate text-xs text-ink-muted"
            // The note's first line leads, because it is the thing that says
            // WHY (Sjoerd, 2026-09-23: "hover should show first line"); the
            // labels follow it.
            title={[
              item.note,
              [item.subject?.label, item.org, ...(item.tags ?? []).map((t) => `#${t}`)]
                .filter(Boolean)
                .join(' · '),
            ]
              .filter(Boolean)
              .join('\n')}
          >
            {[item.team?.name, item.subject?.label, item.org, appName(item.app)]
              .filter(Boolean)
              .join(' · ')}
          </span>
        )}
        {!!item.tags?.length && (
          <span className="mt-0.5 flex flex-wrap gap-1">
            {item.tags.map((t) => (
              <span
                key={t}
                className="rounded bg-surface-sunken px-1 text-[10px] leading-4 text-ink-muted"
              >
                #{t}
              </span>
            ))}
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
