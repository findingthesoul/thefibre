'use client';

// Fibre-styled date fields — replaces native <input type="date"> and
// <input type="datetime-local">, whose browser popovers are cramped and
// unstylable (Sjoerd 2026-07-02: "higher UX quality, more spacious,
// bigger fonts", across all Fibre apps).
//
// Self-contained (no react-day-picker / radix): a trigger button + a
// fixed-position popover. Emits a hidden input so existing
// FormData-based forms keep working unchanged:
//   DateField      → "YYYY-MM-DD" (like type="date")
//   DateTimeField  → "YYYY-MM-DDTHH:mm" (like type="datetime-local")
//
// DateTimeField is ONE popover: calendar on the left, a scrollable time
// column (15-minute steps, 00:00–23:45) on the right. Times remain a
// curated list — house rule: minute fields are never free-form.

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
function fmtDisplay(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ---------------------------------------------------------------------------
// Shared popover shell — fixed positioning (flip above when cramped),
// outside-click + Escape dismissal.
// ---------------------------------------------------------------------------

function PopoverShell({
  anchor,
  width,
  height,
  onClose,
  children,
}: {
  anchor: DOMRect;
  width: number;
  height: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const top =
    anchor.bottom + height + 8 > window.innerHeight && anchor.top - height - 8 > 0
      ? anchor.top - height - 8
      : anchor.bottom + 8;
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 12));

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', top, left, zIndex: 100, width }}
      className="rounded-xl border border-line bg-surface-raised shadow-xl p-4"
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Month grid — header nav + weekday row + 42 cells. Shared by both popovers.
// ---------------------------------------------------------------------------

function MonthGrid({
  selected,
  min,
  max,
  onPick,
}: {
  selected: Date | null;
  min: Date | null;
  max: Date | null;
  onPick: (d: Date) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState<{ year: number; month: number }>(() => {
    const base = selected ?? min ?? today;
    return { year: base.getFullYear(), month: base.getMonth() };
  });

  // If the selected date changes (e.g. footer "Today"), follow it.
  const selectedKey = selected ? toDateString(selected) : '';
  useEffect(() => {
    if (!selected) return;
    setView({ year: selected.getFullYear(), month: selected.getMonth() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  const first = new Date(view.year, view.month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Mon=0
  const gridStart = new Date(view.year, view.month, 1 - startOffset);
  const cells: Date[] = Array.from(
    { length: 42 },
    (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i),
  );

  function nav(delta: number) {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  const disabled = (d: Date) =>
    (min && d < min && !sameDay(d, min)) || (max && d > max && !sameDay(d, max));

  return (
    <div className="w-[292px]">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => nav(-1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-subtle hover:text-ink hover:bg-surface-sunken"
        >
          <ChevronLeft size={18} strokeWidth={1.75} />
        </button>
        <div className="text-[15px] font-medium">
          {MONTHS[view.month]} {view.year}
        </div>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => nav(1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-subtle hover:text-ink hover:bg-surface-sunken"
        >
          <ChevronRight size={18} strokeWidth={1.75} />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7">
        {WEEKDAYS.map((w) => (
          <div key={w} className="h-8 flex items-center justify-center text-xs text-ink-muted">
            {w}
          </div>
        ))}
        {cells.map((d) => {
          const outside = d.getMonth() !== view.month;
          const isSelected = selected ? sameDay(d, selected) : false;
          const isToday = sameDay(d, today);
          const isDisabled = disabled(d);
          return (
            <button
              key={d.toISOString()}
              type="button"
              disabled={!!isDisabled}
              onClick={() => onPick(d)}
              className={`h-10 w-10 mx-auto flex items-center justify-center rounded-md text-[15px] transition-colors ${
                isSelected
                  ? 'bg-ink text-ink-inverse font-medium'
                  : isDisabled
                    ? 'text-ink-muted/40 cursor-not-allowed'
                    : outside
                      ? 'text-ink-muted hover:bg-surface-sunken'
                      : 'text-ink hover:bg-surface-sunken'
              } ${isToday && !isSelected ? 'ring-1 ring-line-strong font-medium' : ''}`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calendar popover (DateField — date only)
// ---------------------------------------------------------------------------

function CalendarPopover({
  anchor,
  selected,
  min,
  max,
  onPick,
  onClear,
  onClose,
  clearable,
}: {
  anchor: DOMRect;
  selected: Date | null;
  min: Date | null;
  max: Date | null;
  onPick: (d: Date) => void;
  onClear: () => void;
  onClose: () => void;
  clearable: boolean;
}) {
  const today = new Date();
  return (
    <PopoverShell anchor={anchor} width={324} height={372} onClose={onClose}>
      <MonthGrid selected={selected} min={min} max={max} onPick={onPick} />
      <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
        <button
          type="button"
          onClick={() => onPick(today)}
          className="text-sm text-ink-subtle hover:text-ink px-2 py-1 rounded-md hover:bg-surface-sunken"
        >
          Today
        </button>
        {clearable && selected && (
          <button
            type="button"
            onClick={onClear}
            className="text-sm text-ink-subtle hover:text-ink px-2 py-1 rounded-md hover:bg-surface-sunken"
          >
            Clear
          </button>
        )}
      </div>
    </PopoverShell>
  );
}

// ---------------------------------------------------------------------------
// Date + time popover (DateTimeField) — calendar left, time column right.
// ---------------------------------------------------------------------------

/** 15-minute steps across the whole day; a set time off-grid is spliced in. */
function buildTimes(current: string | null): string[] {
  const times: string[] = [];
  for (let m = 0; m < 24 * 60; m += 15) {
    times.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  }
  if (current && /^\d{2}:\d{2}$/.test(current) && !times.includes(current)) {
    times.push(current);
    times.sort();
  }
  return times;
}

function DateTimePopover({
  anchor,
  selected,
  time,
  hasValue,
  min,
  max,
  onPickDate,
  onPickTime,
  onClear,
  onClose,
  clearable,
}: {
  anchor: DOMRect;
  selected: Date | null;
  time: string; // "HH:mm" — the current (or default) time
  hasValue: boolean;
  min: Date | null;
  max: Date | null;
  onPickDate: (d: Date) => void;
  onPickTime: (t: string) => void;
  onClear: () => void;
  onClose: () => void;
  clearable: boolean;
}) {
  const today = new Date();
  const times = useMemo(() => buildTimes(time), [time]);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the selected (or default) time into view on open.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLButtonElement>('[data-selected="true"]');
    if (el && listRef.current) {
      listRef.current.scrollTop =
        el.offsetTop - listRef.current.clientHeight / 2 + el.clientHeight / 2;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PopoverShell anchor={anchor} width={436} height={384} onClose={onClose}>
      <div className="flex items-stretch gap-3">
        <MonthGrid selected={selected} min={min} max={max} onPick={onPickDate} />
        <div className="w-[96px] shrink-0 border-l border-line pl-3 relative">
          <div
            ref={listRef}
            className="absolute inset-y-0 left-3 right-0 overflow-y-auto pr-1 flex flex-col gap-0.5"
          >
            {times.map((t) => {
              const isSelected = hasValue && t === time;
              return (
                <button
                  key={t}
                  type="button"
                  data-selected={t === time ? 'true' : undefined}
                  onClick={() => onPickTime(t)}
                  className={`shrink-0 h-9 rounded-md text-[15px] tabular-nums transition-colors ${
                    isSelected
                      ? 'bg-ink text-ink-inverse font-medium'
                      : 'text-ink hover:bg-surface-sunken'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
        <button
          type="button"
          onClick={() => onPickDate(today)}
          className="text-sm text-ink-subtle hover:text-ink px-2 py-1 rounded-md hover:bg-surface-sunken"
        >
          Today
        </button>
        {clearable && hasValue && (
          <button
            type="button"
            onClick={onClear}
            className="text-sm text-ink-subtle hover:text-ink px-2 py-1 rounded-md hover:bg-surface-sunken"
          >
            Clear
          </button>
        )}
      </div>
    </PopoverShell>
  );
}

// ---------------------------------------------------------------------------
// DateField — drop-in for <TextField type="date">
// ---------------------------------------------------------------------------

export function DateField({
  label,
  name,
  defaultValue,
  required,
  hint,
  min,
  max,
  placeholder = 'Pick a date',
  onValueChange,
}: {
  label: React.ReactNode;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  hint?: React.ReactNode;
  min?: string | null;
  max?: string | null;
  placeholder?: string;
  onValueChange?: (v: string) => void;
}) {
  const [value, setValue] = useState<string>(defaultValue?.slice(0, 10) ?? '');
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const selected = parseDate(value);

  function toggle() {
    if (!open && btnRef.current) setAnchor(btnRef.current.getBoundingClientRect());
    setOpen((o) => !o);
  }
  function pick(d: Date) {
    const v = toDateString(d);
    setValue(v);
    onValueChange?.(v);
    setOpen(false);
  }
  function clear() {
    setValue('');
    onValueChange?.('');
    setOpen(false);
  }

  return (
    <div>
      <span className="text-sm text-ink-subtle">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      <input type="hidden" name={name} value={value} />
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="mt-1 w-full h-11 rounded-md border border-line bg-surface-raised px-3.5 text-[15px] text-left flex items-center justify-between gap-2 hover:border-line-strong focus:border-line-strong focus:outline-none"
      >
        <span className={selected ? 'text-ink' : 'text-ink-muted'}>
          {selected ? fmtDisplay(selected) : placeholder}
        </span>
        <span className="flex items-center gap-1.5 text-ink-muted">
          {value && (
            <X
              size={15}
              strokeWidth={1.75}
              className="hover:text-ink"
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
            />
          )}
          <CalendarDays size={17} strokeWidth={1.75} />
        </span>
      </button>
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
      {open && anchor && (
        <CalendarPopover
          anchor={anchor}
          selected={selected}
          min={parseDate(min)}
          max={parseDate(max)}
          onPick={pick}
          onClear={clear}
          onClose={() => setOpen(false)}
          clearable={!required}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DateTimeField — drop-in for <TextField type="datetime-local">
// ONE trigger, ONE popover (calendar + time column).
// Hidden input emits "YYYY-MM-DDTHH:mm" (or '' when no date picked).
// ---------------------------------------------------------------------------

const DEFAULT_TIME = '09:00';

export function DateTimeField({
  label,
  name,
  defaultValue,
  value: controlledValue,
  onChange,
  required,
  hint,
  min,
  max,
}: {
  label?: React.ReactNode;
  name?: string;
  /** "YYYY-MM-DDTHH:mm" (datetime-local shape) or empty. */
  defaultValue?: string | null;
  /** Controlled mode — pass value + onChange (e.g. dynamic slot lists). */
  value?: string;
  onChange?: (v: string) => void;
  required?: boolean;
  hint?: React.ReactNode;
  min?: string | null;
  max?: string | null;
}) {
  const isControlled = controlledValue !== undefined;
  const [internal, setInternal] = useState<string>(defaultValue ?? '');
  const value = isControlled ? (controlledValue ?? '') : internal;

  const date = value.slice(0, 10);
  const timeRaw = value.slice(11, 16);
  const time = /^\d{2}:\d{2}$/.test(timeRaw) ? timeRaw : DEFAULT_TIME;
  const hasValue = !!date;
  const selected = parseDate(date);

  // Remember the last picked time so clearing + re-picking a date feels sane.
  const lastTimeRef = useRef<string>(time);
  if (hasValue) lastTimeRef.current = time;

  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  function emit(v: string) {
    if (!isControlled) setInternal(v);
    onChange?.(v);
  }

  function toggle() {
    if (!open && btnRef.current) setAnchor(btnRef.current.getBoundingClientRect());
    setOpen((o) => !o);
  }

  function pickDate(d: Date) {
    // Picking a date keeps the time; popover stays open for the time pick.
    emit(`${toDateString(d)}T${hasValue ? time : lastTimeRef.current}`);
  }
  function pickTime(t: string) {
    // Picking a time keeps the date (default: today); closes the popover.
    const d = date || toDateString(new Date());
    emit(`${d}T${t}`);
    setOpen(false);
  }
  function clear() {
    emit('');
    setOpen(false);
  }

  return (
    <div>
      {label !== undefined && (
        <span className="text-sm text-ink-subtle">
          {label}
          {required && <span className="text-red-600"> *</span>}
        </span>
      )}
      {name && <input type="hidden" name={name} value={hasValue ? `${date}T${time}` : ''} />}
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={`w-full h-11 rounded-md border border-line bg-surface-raised px-3.5 text-[15px] text-left flex items-center justify-between gap-2 hover:border-line-strong focus:border-line-strong focus:outline-none ${
          label !== undefined ? 'mt-1' : ''
        }`}
      >
        <span className={`truncate ${selected ? 'text-ink' : 'text-ink-muted'}`}>
          {selected ? (
            <>
              {fmtDisplay(selected)}
              <span className="text-ink-muted"> · </span>
              <span className="tabular-nums">{time}</span>
            </>
          ) : (
            'Pick date & time'
          )}
        </span>
        <span className="flex items-center gap-1.5 text-ink-muted shrink-0">
          {hasValue && !required && (
            <X
              size={15}
              strokeWidth={1.75}
              className="hover:text-ink"
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
            />
          )}
          <CalendarDays size={17} strokeWidth={1.75} />
        </span>
      </button>
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
      {open && anchor && (
        <DateTimePopover
          anchor={anchor}
          selected={selected}
          time={time}
          hasValue={hasValue}
          min={parseDate(min)}
          max={parseDate(max)}
          onPickDate={pickDate}
          onPickTime={pickTime}
          onClear={clear}
          onClose={() => setOpen(false)}
          clearable={!required}
        />
      )}
    </div>
  );
}
