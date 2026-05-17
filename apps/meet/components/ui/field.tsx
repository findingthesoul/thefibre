import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';

const INPUT_CLASS =
  'mt-1 w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:border-line-strong focus:outline-none placeholder:text-ink-muted';

type FieldShellProps = {
  label: ReactNode;
  required?: boolean | undefined;
  errors?: string[] | undefined;
  hint?: ReactNode;
  children: ReactNode;
};

function FieldShell({ label, required, errors, hint, children }: FieldShellProps) {
  return (
    <label className="block">
      <span className="text-sm text-ink-subtle">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
      {errors?.map((e) => (
        <span key={e} className="mt-1 block text-xs text-red-700">
          {e}
        </span>
      ))}
    </label>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & {
  label: ReactNode;
  errors?: string[] | undefined;
  hint?: ReactNode;
};

export function TextField({ label, required, errors, hint, ...input }: TextFieldProps) {
  return (
    <FieldShell label={label} required={required} errors={errors} hint={hint}>
      <input className={INPUT_CLASS} required={required} {...input} />
    </FieldShell>
  );
}

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> & {
  label: ReactNode;
  errors?: string[] | undefined;
  hint?: ReactNode;
  options: { value: string; label: string; disabled?: boolean }[];
};

export function SelectField({ label, required, errors, hint, options, ...rest }: SelectFieldProps) {
  return (
    <FieldShell label={label} required={required} errors={errors} hint={hint}>
      <select className={INPUT_CLASS} required={required} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}{o.disabled ? ' — coming soon' : ''}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> & {
  label: ReactNode;
  errors?: string[] | undefined;
  hint?: ReactNode;
};

export function TextAreaField({ label, required, errors, hint, ...rest }: TextAreaProps) {
  return (
    <FieldShell label={label} required={required} errors={errors} hint={hint}>
      <textarea className={`${INPUT_CLASS} min-h-[80px] resize-y`} required={required} {...rest} />
    </FieldShell>
  );
}
