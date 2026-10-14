'use client';

// The discount-code editor — a popup over a list of codes.
//
// Written in The Thread (app/(app)/threads/[id]/coupon-dialog.tsx, the
// thethread-v3 model) and lifted here when Members needed the same thing. It
// is the same dialog: the 3-segment type toggle with its consequential value
// field, the curated usage-limit dropdown, the early-bird switch, the delete
// confirmation. Nothing about it was redesigned on the way; a second editor
// for one concept is how two products start disagreeing about what a code is.
//
// WHAT IS INJECTED, because it is what actually differs between the two:
//   • `save` and `remove` — the server actions or fetches. Thread writes
//     thread_coupon through its own actions; Members writes discount_code
//     through the API. Neither belongs in here.
//   • `scopeOptions` — what a code may be limited TO. Thread offers tickets;
//     Members offers tiers and products. The dialog only needs a list.
//   • `chrome` — Save, Cancel, Delete, Saving…, "Edit {x}": the words that
//     belong to a whole interface rather than to this dialog, which each app
//     already has in its own catalogue.
// Everything else comes from @thefibre/shared/discount-code-admin-i18n.
//
// Thread keeps its own copy until it adopts this in its own commit — that is
// a change to a live page, not part of the lift.

import { useState, useTransition, type ReactNode } from 'react';
import { Trash2, Percent, Coins, Gift } from 'lucide-react';
import type { Locale } from '../i18n.js';
import { discountAdminT as t } from '../discount-code-admin-i18n.js';
import { generateDiscountCode } from '../discount-code-generate.js';
import { Dialog, ConfirmDialog } from './dialog.js';
import { FormError } from './form-error.js';
import { TextField, SelectField } from './fields.js';
import { DateTimeField } from './date-field.js';
import { Button } from './button.js';
import { SwitchField } from './switch.js';

export type DiscountCodeType = 'percentage' | 'amount' | 'free';

/** A code as the editor needs it. Both tables carry these columns; the
 *  SCOPE is named generically, because Thread limits a code to a ticket and
 *  Members to a tier or a product. */
export type EditableCode = {
  id: string;
  code: string;
  name: string | null;
  type: DiscountCodeType;
  discount_percentage: number | null;
  discount_amount_cents: number | null;
  usage_limit: number | null;
  expires_at: string | null;
  is_early_bird: boolean;
  early_bird_deadline: string | null;
  is_active: boolean;
  /** What it is limited to, or null for everything. */
  scope_id?: string | null;
};

export type DiscountCodeDraft = Omit<EditableCode, 'id'>;

export type SaveResult = { ok: true } | { ok: false; error: string };

// House rule: a usage limit is a curated dropdown, never a free-form input.
const USAGE_OPTIONS = ['10', '25', '50', '100', '250'];

/** ISO → "YYYY-MM-DDTHH:mm" for the picker, in the browser's own zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): string | null {
  return v ? new Date(v).toISOString() : null;
}

export function DiscountCodeDialog({
  locale,
  code,
  scopeOptions,
  scopeAllLabel,
  chrome,
  onSave,
  onDelete,
  onClose,
  onSaved,
}: {
  locale: Locale;
  /** The code being edited, or null to add one. */
  code: EditableCode | null;
  /** What a code may be limited to. Empty means this app offers no scoping,
   *  and the field is not shown at all rather than shown with one option. */
  scopeOptions: { value: string; label: string }[];
  /** "All tickets", "Every tier" — the app's own word for no limit. */
  scopeAllLabel?: ReactNode;
  chrome: { save: string; cancel: string; delete: string; saving: string; editTitle: (code: string) => string };
  onSave: (draft: DiscountCodeDraft, id: string | null) => Promise<SaveResult>;
  onDelete?: (id: string) => Promise<SaveResult>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !code;
  const [type, setType] = useState<DiscountCodeType>(code?.type ?? 'percentage');
  const [earlyBird, setEarlyBird] = useState(code?.is_early_bird ?? false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  /** THE CODE IN THE FIELD — a controlled value, not a remount.
   *
   *  The first version left the field uncontrolled and changed it by giving
   *  it a new `key`, so React would throw the old input away and build a new
   *  one with a new `defaultValue`. That works, but whether it works depends
   *  on React's reconciliation and on `TextField` passing `defaultValue`
   *  through — neither of which this repo can test, because there is no
   *  component renderer here, only tests of pure functions.
   *
   *  An untestable mechanism in a place where "the button silently does
   *  nothing" is a plausible failure is the wrong trade. A controlled value
   *  makes it ordinary: Generate sets the state, the input shows it, and
   *  typing replaces it. The form still reads the field by name on submit. */
  const [codeText, setCodeText] = useState(code?.code ?? '');

  // Splice an existing limit into the curated list, so editing a code with a
  // limit nobody would pick today does not silently change it.
  const currentLimit = code?.usage_limit ? String(code.usage_limit) : '';
  const usageOptions = [
    { value: '', label: t(locale, 'unlimited') },
    ...(currentLimit && !USAGE_OPTIONS.includes(currentLimit)
      ? [...USAGE_OPTIONS, currentLimit].sort((a, b) => Number(a) - Number(b))
      : USAGE_OPTIONS
    ).map((u) => ({ value: u, label: t(locale, 'n_uses', { n: u }) })),
  ];

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const typed = String(fd.get('code') ?? '')
      .trim()
      .toUpperCase();
    if (!typed) return setError(t(locale, 'err_code_value'));
    // No wildcards in a code. Both are metacharacters to the layer that
    // matches them, so such a code could be created and never redeemed —
    // the API refuses it too, and saying so here is kinder than a 400.
    if (/[%*]/.test(typed)) return setError('A code cannot contain % or *.');

    let discount_percentage: number | null = null;
    let discount_amount_cents: number | null = null;
    if (type === 'percentage') {
      const pct = Number(fd.get('discount_percentage') ?? 0);
      if (!pct || pct < 1 || pct > 100) return setError(t(locale, 'err_percentage'));
      discount_percentage = pct;
    } else if (type === 'amount') {
      const amount = Number(String(fd.get('discount_amount') ?? '0').replace(',', '.'));
      if (!amount || amount <= 0) return setError(t(locale, 'err_discount_amount'));
      discount_amount_cents = Math.round(amount * 100);
    }

    const limit = String(fd.get('usage_limit') ?? '');
    const scope = String(fd.get('scope_id') ?? '');
    const draft: DiscountCodeDraft = {
      code: typed,
      name: String(fd.get('name') ?? '').trim() || null,
      type,
      discount_percentage,
      discount_amount_cents,
      usage_limit: limit ? Number(limit) : null,
      expires_at: fromLocalInput(String(fd.get('expires_at') ?? '')),
      is_early_bird: earlyBird,
      early_bird_deadline: earlyBird
        ? fromLocalInput(String(fd.get('early_bird_deadline') ?? ''))
        : null,
      is_active: fd.get('is_active') === 'on',
      scope_id: scope || null,
    };

    startTransition(async () => {
      const r = await onSave(draft, code?.id ?? null);
      if (!r.ok) return setError(r.error);
      onSaved();
    });
  }

  function doDelete() {
    if (!code || !onDelete) return;
    startTransition(async () => {
      const r = await onDelete(code.id);
      setConfirmDelete(false);
      if (!r.ok) return setError(r.error);
      onSaved();
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={isNew ? t(locale, 'add_discount_code') : chrome.editTitle(code.code)}
      footer={
        <>
          {!isNew && onDelete && (
            <div className="mr-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leading={<Trash2 size={14} />}
                onClick={() => setConfirmDelete(true)}
              >
                {chrome.delete}
              </Button>
            </div>
          )}
          {error && <FormError message={error} />}
          <Button type="button" variant="secondary" onClick={onClose}>
            {chrome.cancel}
          </Button>
          <Button type="submit" form="discount-code-form" disabled={pending}>
            {pending ? chrome.saving : isNew ? t(locale, 'add_code') : chrome.save}
          </Button>
        </>
      }
    >
      <form id="discount-code-form" onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* THE CODE, TYPED OR GENERATED.
              Generate fills the field with a readable random code
              (@thefibre/shared/discount-code-generate — uppercase, two groups
              of four, no look-alikes, from crypto and not Math.random,
              because a discount code is worth money). The admin can still
              type over it: this offers a good default, it does not take the
              choice away.
              `key` is what puts the value in. The field is uncontrolled —
              every other field in this form is — so remounting it with a new
              defaultValue is how it changes without turning this one input
              into the only controlled one in the dialog. */}
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <TextField
                label={t(locale, 'code')}
                name="code"
                required
                placeholder="EARLYBIRD"
                value={codeText}
                onChange={(e) => setCodeText(e.target.value)}
                autoCapitalize="characters"
                style={{ textTransform: 'uppercase' }}
                hint={t(locale, 'uppercased_hint')}
              />
            </div>
            <button
              type="button"
              onClick={() => setCodeText(generateDiscountCode())}
              className="mb-[26px] shrink-0 rounded-md border border-line px-3 h-[38px] text-sm hover:border-line-strong"
            >
              {t(locale, 'generate_code')}
            </button>
          </div>
          <TextField
            label={t(locale, 'name')}
            name="name"
            placeholder={t(locale, 'early_bird')}
            defaultValue={code?.name ?? ''}
          />
        </div>

        {/* Type: a 3-segment toggle, never a bare select for a small closed
            set, with the field its choice makes consequential. */}
        <div>
          <span className="text-sm text-ink-subtle">{t(locale, 'type')}</span>
          <div className="mt-1 grid grid-cols-3 rounded-md border border-line overflow-hidden h-[38px]">
            <ModeButton
              Icon={Percent}
              label={t(locale, 'percentage')}
              active={type === 'percentage'}
              onClick={() => setType('percentage')}
            />
            <ModeButton
              Icon={Coins}
              label={t(locale, 'amount_label')}
              active={type === 'amount'}
              onClick={() => setType('amount')}
            />
            <ModeButton
              Icon={Gift}
              label={t(locale, 'free')}
              active={type === 'free'}
              onClick={() => setType('free')}
            />
          </div>
        </div>

        {type === 'percentage' && (
          <TextField
            label={t(locale, 'discount')}
            name="discount_percentage"
            type="number"
            min={1}
            max={100}
            placeholder="20"
            defaultValue={code?.discount_percentage ?? ''}
            hint={t(locale, 'percent_hint')}
          />
        )}
        {type === 'amount' && (
          <TextField
            label={t(locale, 'discount_amount')}
            name="discount_amount"
            inputMode="decimal"
            placeholder="10.00"
            defaultValue={
              code?.discount_amount_cents ? (code.discount_amount_cents / 100).toFixed(2) : ''
            }
            hint={t(locale, 'amount_hint')}
          />
        )}
        {type === 'free' && (
          <p className="text-xs text-ink-muted rounded-md border border-line bg-surface-sunken/50 px-3 py-2">
            {t(locale, 'free_code_note')}
          </p>
        )}

        {scopeOptions.length > 0 && (
          <SelectField
            label={t(locale, 'applies_to')}
            name="scope_id"
            defaultValue={code?.scope_id ?? ''}
            options={[
              { value: '', label: String(scopeAllLabel ?? t(locale, 'all_tickets')) },
              ...scopeOptions,
            ]}
            hint={t(locale, 'scope_hint')}
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label={t(locale, 'usage_limit')}
            name="usage_limit"
            defaultValue={currentLimit}
            options={usageOptions}
          />
          <DateTimeField
            label={t(locale, 'expires')}
            name="expires_at"
            defaultValue={toLocalInput(code?.expires_at ?? null)}
          />
        </div>

        <div className="pt-1">
          <SwitchField
            label={t(locale, 'early_bird_switch')}
            checked={earlyBird}
            onChange={setEarlyBird}
          />
        </div>
        {earlyBird && (
          <DateTimeField
            label={t(locale, 'early_bird_deadline')}
            name="early_bird_deadline"
            defaultValue={toLocalInput(code?.early_bird_deadline ?? null)}
          />
        )}

        <div className="pt-1">
          <SwitchField
            label={t(locale, 'active_redeemable')}
            name="is_active"
            defaultChecked={code?.is_active ?? true}
          />
        </div>
      </form>

      {onDelete && (
        <ConfirmDialog
          open={confirmDelete}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={doDelete}
          title={t(locale, 'delete_discount_code')}
          message={
            <>
              {t(locale, 'delete_q_1')} <strong>{code?.code}</strong>
              {t(locale, 'delete_q_2')}
            </>
          }
          confirmLabel={chrome.delete}
          destructive
          pending={pending}
        />
      )}
    </Dialog>
  );
}

function ModeButton({
  Icon,
  label,
  active,
  onClick,
}: {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 text-sm transition-colors ${
        active
          ? 'bg-ink text-ink-inverse font-medium'
          : 'bg-surface-raised text-ink-subtle hover:text-ink'
      }`}
    >
      <Icon size={14} strokeWidth={1.75} />
      {label}
    </button>
  );
}
