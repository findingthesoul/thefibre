'use client';

// Small dependency-free type-ahead combobox for the opportunity dialog:
// filters a preloaded option list and grows an inline "Create '<query>'"
// escape hatch when a create handler is supplied. Lives in the pipeline
// folder on purpose — it is not (yet) a shared component.

import { useMemo, useState } from 'react';

export type ComboOption = { id: string; label: string; sublabel?: string | null };

export type ComboCreateResult = { option?: ComboOption; error?: string };

const INPUT =
  'w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300';
const INPUT_SM =
  'w-full rounded-md border border-line bg-surface-raised px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300';

export function Combobox({
  value,
  options,
  placeholder,
  emptyLabel,
  onSelect,
  onCreate,
  createExtraField,
  onFreeText,
  freeLabel,
  actionItem,
  small,
}: {
  value: string;
  options: ComboOption[];
  placeholder?: string;
  /** First item when the query is empty — selecting it clears the value. */
  emptyLabel?: string;
  onSelect: (id: string) => void;
  /** Present = the list ends with a "Create '<query>'" item. */
  onCreate?: (query: string, extra?: string) => Promise<ComboCreateResult>;
  /** Extra value collected before onCreate runs (e.g. the email a person requires). */
  createExtraField?: { label: string; placeholder?: string };
  /** Present = typing a non-match keeps it as free text: committed on blur
   *  and via a "Use '<query>'" list item (the offering rows' name field). */
  onFreeText?: (text: string) => void;
  /** Shown when no option is selected (the current free-text value). */
  freeLabel?: string;
  /** A fixed last entry regardless of the query (e.g. "Add person…"). */
  actionItem?: { label: string; onPick: () => void };
  /** Compact input (the invoice-style offering rows). */
  small?: boolean;
}) {
  const selected = options.find((o) => o.id === value) ?? null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null); // null = show the selected label
  const [active, setActive] = useState(0);
  const [pendingCreate, setPendingCreate] = useState<string | null>(null);
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rawQuery = (query ?? '').trim();
  const q = rawQuery.toLowerCase();

  // Case-insensitive substring on label (name) and sublabel (email), max 8.
  const filtered = useMemo(() => {
    if (!q) return options.slice(0, 8);
    return options
      .filter(
        (o) => o.label.toLowerCase().includes(q) || (o.sublabel ?? '').toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [options, q]);

  const showEmpty = Boolean(emptyLabel) && !q;
  const showCreate = Boolean(onCreate) && q.length > 0;

  type Item = { key: string; node: React.ReactNode; onPick: () => void };
  const items: Item[] = [];
  if (showEmpty) {
    items.push({
      key: '__empty',
      node: <span className="text-ink-muted">{emptyLabel}</span>,
      onPick: () => pick(''),
    });
  }
  for (const o of filtered) {
    items.push({
      key: o.id,
      node: (
        <span className="block truncate">
          {o.label}
          {o.sublabel ? <span className="text-ink-muted"> · {o.sublabel}</span> : null}
        </span>
      ),
      onPick: () => pick(o.id),
    });
  }
  if (showCreate) {
    items.push({
      key: '__create',
      node: (
        <span className="font-medium">
          {busy && !pendingCreate ? 'Creating…' : <>Create &lsquo;{rawQuery}&rsquo;</>}
        </span>
      ),
      onPick: startCreate,
    });
  }
  // Free text: a typed non-match is a legitimate value (offering row names).
  if (onFreeText && rawQuery && !options.some((o) => o.label === rawQuery)) {
    items.push({
      key: '__free',
      node: (
        <span>
          Use &lsquo;<span className="font-medium">{rawQuery}</span>&rsquo;
        </span>
      ),
      onPick: () => {
        onFreeText(rawQuery);
        close();
      },
    });
  }
  if (actionItem) {
    items.push({
      key: '__action',
      node: <span className="font-medium">{actionItem.label}</span>,
      onPick: () => {
        actionItem.onPick();
        close();
      },
    });
  }

  function close() {
    setOpen(false);
    setQuery(null);
    setActive(0);
    setPendingCreate(null);
    setExtra('');
    setError(null);
  }

  function pick(id: string) {
    onSelect(id);
    close();
  }

  async function runCreate(creationQuery: string, extraValue?: string) {
    if (!onCreate || busy) return;
    setBusy(true);
    setError(null);
    const res = await onCreate(creationQuery, extraValue);
    setBusy(false);
    if (res.error || !res.option) {
      setError(res.error ?? 'Could not create.');
      return;
    }
    onSelect(res.option.id);
    close();
  }

  function startCreate() {
    if (!rawQuery || busy) return;
    if (createExtraField) {
      setPendingCreate(rawQuery);
      setError(null);
    } else {
      void runCreate(rawQuery);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      // Never let Enter submit the surrounding dialog form while we're open.
      e.preventDefault();
      items[Math.min(active, items.length - 1)]?.onPick();
    }
  }

  const display = query !== null ? query : selected?.label ?? freeLabel ?? '';

  return (
    <div
      className="relative"
      onBlur={(e) => {
        // Close only when focus truly leaves the combobox (input → panel is fine).
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          // Free-text mode: leaving with an edited query commits it as the
          // value (picking an option resets query first, so no double-fire).
          if (onFreeText && query !== null && rawQuery !== (selected?.label ?? freeLabel ?? '')) {
            onFreeText(rawQuery);
          }
          close();
        }
      }}
    >
      <input
        value={display}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
          setPendingCreate(null);
          setError(null);
        }}
        onKeyDown={onKeyDown}
        className={small ? INPUT_SM : INPUT}
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-line bg-surface-raised shadow-card overflow-hidden">
          {pendingCreate && createExtraField ? (
            <div className="p-3 space-y-2">
              <p className="text-xs text-ink-muted">
                Creating <span className="font-medium text-ink">{pendingCreate}</span> —{' '}
                {createExtraField.label.toLowerCase()} required.
              </p>
              <input
                autoFocus
                value={extra}
                placeholder={createExtraField.placeholder}
                onChange={(e) => setExtra(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void runCreate(pendingCreate, extra.trim() || undefined);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    close();
                  }
                }}
                className={INPUT_SM}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={close}
                  disabled={busy}
                  className="rounded-md px-2 py-1 text-xs text-ink-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void runCreate(pendingCreate, extra.trim() || undefined)}
                  disabled={busy}
                  className="rounded-md bg-ink px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
                >
                  {busy ? 'Creating…' : 'Create'}
                </button>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
          ) : (
            <>
              <ul className="max-h-64 overflow-y-auto py-1 text-sm">
                {items.length === 0 && <li className="px-3 py-2 text-ink-muted">No matches.</li>}
                {items.map((item, i) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={item.onPick}
                      onMouseEnter={() => setActive(i)}
                      className={`w-full px-3 py-2 text-left ${i === active ? 'bg-slate-50' : ''}`}
                    >
                      {item.node}
                    </button>
                  </li>
                ))}
              </ul>
              {error && <div className="px-3 pb-2 text-xs text-red-600">{error}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
