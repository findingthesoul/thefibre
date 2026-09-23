'use client';

// THE canonical Switch — extracted 2026-09-05 (component-inventory Phase 1)
// from the byte-identical thread/pulse/membership copies.

import { useId, useState, type ReactNode } from 'react';

// iOS-style toggle in the Fibre accent (Sjoerd 2026-07-07: "a button like
// img 1") — label on the left, yellow track when on. The whole row is one
// button, so clicking the label toggles too.
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  labelledBy,
  describedBy,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  disabled?: boolean | undefined;
  /** Id of the text that names this switch, when the label is rendered
   *  OUTSIDE the button (SwitchField does that). Without it the control has
   *  no accessible name at all: a screen reader says "switch, on" and never
   *  says of what. Found 2026-09-23, when a test could not find a toggle by
   *  its visible label — which is exactly the thing a person cannot do
   *  either. */
  labelledBy?: string | undefined;
  /** Id of the hint under the label, if there is one. */
  describedBy?: string | undefined;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {label && <span className="text-sm text-ink-subtle select-none">{label}</span>}
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-save' : 'bg-surface-sunken ring-1 ring-line'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

/** Switch as a labelled settings row (label + optional hint left, switch
 *  right). Pass `name` to emit a hidden input ('on' / '') so existing
 *  FormData readers (`fd.get(x) === 'on'`) keep working; pass
 *  checked/onChange for controlled use. */
export function SwitchField({
  label,
  hint,
  name,
  defaultChecked,
  checked,
  onChange,
  disabled,
}: {
  label: ReactNode;
  hint?: ReactNode;
  name?: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  const labelId = useId();
  const hintId = useId();
  const isControlled = checked !== undefined;
  const [internal, setInternal] = useState(!!defaultChecked);
  const on = isControlled ? checked : internal;
  function set(v: boolean) {
    if (!isControlled) setInternal(v);
    onChange?.(v);
  }
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-ink-subtle">
        <span id={labelId}>{label}</span>
        {hint && (
          <span id={hintId} className="mt-0.5 block text-xs text-ink-muted">
            {hint}
          </span>
        )}
      </span>
      {name && <input type="hidden" name={name} value={on ? 'on' : ''} />}
      <Switch
        checked={on}
        onChange={set}
        disabled={disabled}
        labelledBy={labelId}
        describedBy={hint ? hintId : undefined}
      />
    </div>
  );
}
