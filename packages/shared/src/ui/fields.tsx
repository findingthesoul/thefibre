import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { chromeT, useLocale } from './i18n-ui.js';

// ONE size for every field: the date field's. Sjoerd, 2026-09-14, looking at a
// form with a select beside a date: "Why are the dropdowns another format than
// the date... this is bad design." They were: inputs and selects were
// px-3 py-2 text-sm (and Safari draws a native select at its own, shorter
// height, ignoring the padding), while DateField/DateTimeField were
// h-11 px-3.5 text-[15px] — the size he asked for on 2026-07-02 ("more
// spacious, bigger fonts"). Everything now matches the date field.
const SURFACE =
  'w-full rounded-md border border-line bg-surface-raised px-3.5 text-[15px] focus:border-line-strong focus:outline-none placeholder:text-ink-muted';
const INPUT_CLASS = `mt-1 h-11 ${SURFACE}`;
// appearance-none so Safari honours the height; the arrow is drawn instead.
const SELECT_CLASS = `mt-1 h-11 appearance-none pr-10 ${SURFACE}`;
const TEXTAREA_CLASS = `mt-1 py-2.5 ${SURFACE}`;

/**
 * The look of every text input, select and textarea, for the rare control that
 * cannot be a TextField/SelectField — a search box with an icon inside, or a
 * textarea with highlights painted behind it. Use the fields when you can;
 * use this instead of writing the classes again. Exported 2026-09-14 after
 * Connections grew a second, smaller form style next to this one.
 */
export const FIELD_CLASS = `py-2.5 ${SURFACE}`;

/** The same, without `w-full` — for a control in a row (a filter bar) that sizes to its content. */
export const FIELD_CLASS_INLINE = FIELD_CLASS.replace('w-full ', '');

/** The label above a field, for the same rare controls. */
export const FIELD_LABEL_CLASS = 'text-sm text-ink-subtle';

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
  // `disabled` (from Meet): the option shows greyed with a " — coming soon"
  // suffix and cannot be selected.
  options: { value: string; label: string; disabled?: boolean }[];
};

export function SelectField({ label, required, errors, hint, options, ...rest }: SelectFieldProps) {
  // Every SelectField consumer is a 'use client' file (checked 2026-09-06:
  // 24/24), so the hook is safe here even though this module has no
  // directive of its own.
  const locale = useLocale();
  return (
    <FieldShell label={label} required={required} errors={errors} hint={hint}>
      <span className="relative block">
        <select className={SELECT_CLASS} required={required} {...rest}>
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}{o.disabled ? chromeT(locale, 'coming_soon_suffix') : ''}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          aria-hidden="true"
          className="pointer-events-none absolute right-3.5 top-1/2 mt-0.5 -translate-y-1/2 text-ink-muted"
        />
      </span>
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
      <textarea className={`${TEXTAREA_CLASS} min-h-[80px] resize-y`} required={required} {...rest} />
    </FieldShell>
  );
}
