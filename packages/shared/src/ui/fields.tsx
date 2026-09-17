import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { chromeT, useLocale } from './i18n-ui.js';

// ONE size for every field, and it is the compact one (Sjoerd, 2026-09-14).
//
// The history, because this box has now moved twice in a day and the reason
// matters more than the number. Text inputs and selects were compact
// (px-3 py-2 text-sm) while DateField was taller (h-11 px-3.5 text-[15px]), and
// Sjoerd called the mismatch bad design in the Connections chat, so v0.75.1
// grew every field to the date field's size. Seeing that on The Thread's
// dialogs he said: "The design of the thread popups just went rogue. It was
// great. Now it is terrible." Asked which he wanted everywhere, with both of
// his requests put to him side by side, he chose: compact, and the date field
// shrinks to match. So consistency survived and the size went back.
//
// FIXED HEIGHT rather than vertical padding, deliberately: Safari draws a
// native <select> at its own height and ignores padding, which was half of
// the original complaint. h-[38px] is what px-3 py-2 text-sm with a 1px border
// renders to, and it is exactly the height of The Thread's In person / Virtual
// segmented control, which sits beside these fields in the engagement dialog.
// DateField and DateTimeField use the same box (date-field.tsx). If you change
// one, change FIELD_BOX and those two triggers in the same commit.
//
// 16px ON PHONES, 14px FROM `sm` UP (Sjoerd, 2026-09-17, on his phone: "when I
// start to use the text field, the screen zooms in. It does not zoom out
// again"). iOS Safari zooms the page into any input, textarea or select whose
// text is smaller than 16px, and never zooms back out. The alternative, a
// viewport maximum-scale, switches pinch zoom off on Android for everyone, so
// the size is the honest fix. The date-field triggers and the Connections note
// box (tag-highlight-box.tsx) carry the same pair so a row of fields stays one
// size on every width.
export const FIELD_TEXT = 'text-base sm:text-sm';
export const FIELD_BOX = `h-[38px] px-3 ${FIELD_TEXT}`;
const SURFACE =
  'w-full rounded-md border border-line bg-surface-raised focus:border-line-strong focus:outline-none placeholder:text-ink-muted';
const INPUT_CLASS = `mt-1 ${FIELD_BOX} ${SURFACE}`;
// appearance-none so Safari honours the height; the arrow is drawn instead.
const SELECT_CLASS = `mt-1 ${FIELD_BOX} appearance-none pr-9 ${SURFACE}`;
const TEXTAREA_CLASS = `mt-1 px-3 py-2 ${FIELD_TEXT} ${SURFACE}`;

/**
 * For controls that cannot be a TextField/SelectField/TextAreaField — use the
 * components whenever there is a label. Exported 2026-09-14 after Connections
 * grew a second, smaller form style next to this one. Pick by shape:
 *
 *   FIELD_CLASS             a textarea, or a wrapper around multi-line text
 *   FIELD_INPUT_CLASS(_INLINE)  a single-line <input> (search box, cell)
 *   <FieldSelect>           a select without a label (filter bar)
 *   FIELD_LABEL_CLASS       the label above any of them
 */
export const FIELD_CLASS = `px-3 py-2 ${FIELD_TEXT} ${SURFACE}`;

/**
 * A single-line `<input>` that is not a TextField (a search box with an icon
 * inside, a builder cell): exactly TextField's box (FIELD_BOX) — so it lines up with
 * every other field. FIELD_CLASS is for textareas and multi-line wrappers.
 */
export const FIELD_INPUT_CLASS = `${FIELD_BOX} ${SURFACE}`;
/** The same, sized to its content or a width you give it. */
export const FIELD_INPUT_CLASS_INLINE = FIELD_INPUT_CLASS.replace('w-full ', '');

type FieldSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> & {
  options: { value: string; label: string; disabled?: boolean }[];
  /** Size to the content (a filter bar) instead of filling the row. */
  inline?: boolean;
};

/**
 * SelectField without the label — for a filter bar or a row of controls. The
 * same box and the same drawn arrow as SelectField, so the two never differ.
 * Give it an `aria-label` when there is no visible label beside it.
 */
export function FieldSelect({ options, inline = false, ...rest }: FieldSelectProps) {
  return (
    <span className={`relative ${inline ? 'inline-block' : 'block'}`}>
      <select className={`${FIELD_BOX} appearance-none pr-9 ${inline ? SURFACE.replace('w-full ', '') : SURFACE}`} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        strokeWidth={1.75}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
      />
    </span>
  );
}

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
          className="pointer-events-none absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 text-ink-muted"
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
