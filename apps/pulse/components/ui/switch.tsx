'use client';

import { useState, type ReactNode } from 'react';

// iOS-style toggle in the Fibre accent (Sjoerd 2026-07-07: "a button like
// img 1") — label on the left, yellow track when on. The whole row is one
// button, so clicking the label toggles too.
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {label && <span className="text-sm text-ink-subtle select-none">{label}</span>}
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-yellow-400' : 'bg-surface-sunken ring-1 ring-line'
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
        {label}
        {hint && <span className="mt-0.5 block text-xs text-ink-muted">{hint}</span>}
      </span>
      {name && <input type="hidden" name={name} value={on ? 'on' : ''} />}
      <Switch checked={on} onChange={set} disabled={disabled} />
    </div>
  );
}
