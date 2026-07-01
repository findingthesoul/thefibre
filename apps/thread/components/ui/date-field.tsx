'use client';

// Fibre-styled date fields — replaces native <input type="date"> and
// <input type="datetime-local">, whose browser popovers are cramped and
// unstylable (Sjoerd 2026-07-02: "higher UX quality, more spacious,
// bigger fonts", across all Fibre apps).
//
// Self-contained (no react-day-picker / radix): a trigger button + a
// fixed-position calendar popover. Emits a hidden input so existing
// FormData-based forms keep working unchanged:
//   DateField      → "YYYY-MM-DD" (like type="date")
//   DateTimeField  → "YYYY-MM-DDTHH:mm" (like type="datetime-local")
//
// Times use curated dropdowns (hours + quarter-hour minutes) — house rule:
// minute fields are curated dropdowns, never free-form.

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
// Calendar popover (shared by both fields)
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
  const ref = useRef<HTMLDivElement>(null);
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState<{ year: number; month: number }>(() => {
    const base = selected ?? min ?? today;
    return { year: base.getFullYear(), month: base.getMonth() };
  });

  // Close on outside click / Escape.
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

  // Fixed positioning below the trigger; flip above when there's no room.
  const POPOVER_H = 372;
  const top =
    anchor.bottom + POPOVER_H + 8 > window.innerHeight && anchor.top - POPOVER_H - 8 > 0
      ? anchor.top - POPOVER_H - 8
      : anchor.bottom + 8;
  const left = Math.min(anchor.left, window.innerWidth - 336);

  // Build the month grid (weeks start Monday).
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

  const disabled = (d: Date) => (min && d < min && !sameDay(d, min)) || (max && d > max && !sameDay(d, max));

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', top, left, zIndex: 100 }}
      className="w-[324px] rounded-xl border border-line bg-surface-raised shadow-xl p-4"
    >
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
    </div>
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
// Hidden input emits "YYYY-MM-DDTHH:mm" (or '' when no date picked).
// ---------------------------------------------------------------------------

const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = ['00', '15', '30', '45'];

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
  const initial = (isControlled ? controlledValue : defaultValue) ?? '';
  const [internalDate, setDate] = useState<string>(initial ? initial.slice(0, 10) : '');
  const [internalHour, setHour] = useState<string>(initial ? initial.slice(11, 13) || '09' : '09');
  const [internalMinute, setMinute] = useState<string>(() => {
    const m = initial ? initial.slice(14, 16) : '';
    return MINUTES.includes(m) ? m : '00';
  });
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // In controlled mode the prop is the source of truth on every render.
  const date = isControlled ? (controlledValue ?? '').slice(0, 10) : internalDate;
  const hour = isControlled
    ? (controlledValue ?? '').slice(11, 13) || '09'
    : internalHour;
  const rawMin = isControlled ? (controlledValue ?? '').slice(14, 16) : internalMinute;
  const minute = MINUTES.includes(rawMin) ? rawMin : '00';

  function emit(d: string, h: string, m: string) {
    const v = d ? `${d}T${h}:${m}` : '';
    if (!isControlled) {
      setDate(d);
      setHour(h);
      setMinute(m);
    }
    onChange?.(v);
  }

  const selected = parseDate(date);
  const value = date ? `${date}T${hour}:${minute}` : '';

  function toggle() {
    if (!open && btnRef.current) setAnchor(btnRef.current.getBoundingClientRect());
    setOpen((o) => !o);
  }

  const timeSelect =
    'h-11 rounded-md border border-line bg-surface-raised px-2.5 text-[15px] tabular-nums focus:border-line-strong focus:outline-none disabled:opacity-40';

  return (
    <div>
      {label !== undefined && (
        <span className="text-sm text-ink-subtle">
          {label}
          {required && <span className="text-red-600"> *</span>}
        </span>
      )}
      {name && <input type="hidden" name={name} value={value} />}
      <div className={`flex items-center gap-2 ${label !== undefined ? 'mt-1' : ''}`}>
        <button
          ref={btnRef}
          type="button"
          onClick={toggle}
          className="flex-1 min-w-0 h-11 rounded-md border border-line bg-surface-raised px-3.5 text-[15px] text-left flex items-center justify-between gap-2 hover:border-line-strong focus:border-line-strong focus:outline-none"
        >
          <span className={`truncate ${selected ? 'text-ink' : 'text-ink-muted'}`}>
            {selected ? fmtDisplay(selected) : 'Pick a date'}
          </span>
          <span className="flex items-center gap-1.5 text-ink-muted shrink-0">
            {date && (
              <X
                size={15}
                strokeWidth={1.75}
                className="hover:text-ink"
                onClick={(e) => {
                  e.stopPropagation();
                  emit('', hour, minute);
                  setOpen(false);
                }}
              />
            )}
            <CalendarDays size={17} strokeWidth={1.75} />
          </span>
        </button>
        <select
          aria-label="Hour"
          className={timeSelect}
          value={hour}
          disabled={!date}
          onChange={(e) => emit(date, e.target.value, minute)}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span className="text-ink-muted text-[15px] select-none">:</span>
        <select
          aria-label="Minutes"
          className={timeSelect}
          value={minute}
          disabled={!date}
          onChange={(e) => emit(date, hour, e.target.value)}
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
      {open && anchor && (
        <CalendarPopover
          anchor={anchor}
          selected={selected}
          min={parseDate(min)}
          max={parseDate(max)}
          onPick={(d) => {
            emit(toDateString(d), hour, minute);
            setOpen(false);
          }}
          onClear={() => {
            emit('', hour, minute);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
          clearable={!required}
        />
      )}
    </div>
  );
}
