'use client';

// The list, and the dialog over it.
//
// The DIALOG is the shared one — the same editor The Thread has had since
// July, lifted to @thefibre/shared/ui/discount-code-dialog rather than
// rebuilt. What this file supplies is the two things that genuinely differ:
// where a code is written (the API, through server actions), and what it may
// be limited to (a tier or a product, where Thread offers tickets).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Ticket } from 'lucide-react';
import {
  DiscountCodeDialog,
  type DiscountCodeDraft,
  type EditableCode,
} from '@thefibre/shared/ui/discount-code-dialog';
import { ROW_LIST } from '@thefibre/shared/ui/recipes';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/money';
import { t, type Locale } from '@/lib/i18n-ui';
import { saveDiscountCode, removeDiscountCode } from './actions';

export type AdminCodeRow = EditableCode & {
  used_count: number;
  applies_to: 'workspace' | 'thread' | 'ticket' | 'tier' | 'product';
  applies_to_id: string | null;
};

export type ScopeOption = { value: string; label: string; kind: 'tier' | 'product' };

export function DiscountCodesClient({
  initial,
  scopeOptions,
  locale,
}: {
  initial: AdminCodeRow[];
  scopeOptions: ScopeOption[];
  locale: Locale;
}) {
  const [editing, setEditing] = useState<AdminCodeRow | null>(null);
  const [adding, setAdding] = useState(false);
  const router = useRouter();
  const rows = initial;

  // `router.refresh()`, not a second fetch route: a server action's
  // revalidatePath does not refresh the client route in this flow, and the
  // page already knows how to load itself (gotcha since v0.3.11).
  function refresh() {
    setEditing(null);
    setAdding(false);
    router.refresh();
  }

  /** What a code does, in the list, without opening it. */
  const effect = (row: AdminCodeRow) =>
    row.type === 'free'
      ? t(locale, 'free')
      : row.type === 'percentage'
        ? `−${row.discount_percentage ?? 0}%`
        : `−${money(row.discount_amount_cents ?? 0, 'EUR')}`;

  const scopeLabel = (row: AdminCodeRow) =>
    row.applies_to === 'workspace'
      ? t(locale, 'dc_everything')
      : (scopeOptions.find((o) => o.value === row.applies_to_id)?.label ??
        t(locale, 'dc_something_removed'));

  return (
    <div>
      <div className="flex justify-end">
        <Button type="button" leading={<Plus size={14} />} onClick={() => setAdding(true)}>
          {t(locale, 'dc_add')}
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-lg border border-line bg-surface-sunken px-5 py-8 text-center">
          <Ticket size={20} className="mx-auto text-ink-muted" strokeWidth={1.5} />
          <p className="mt-2 text-sm text-ink">{t(locale, 'dc_none_yet')}</p>
          <p className="mt-1 text-xs text-ink-subtle">{t(locale, 'dc_none_hint')}</p>
        </div>
      ) : (
        <div className={`mt-6 ${ROW_LIST}`}>
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setEditing(row)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-sunken"
            >
              <span className="font-mono text-sm text-ink">{row.code}</span>
              <span className="text-sm text-ink-subtle">{effect(row)}</span>
              <span className="ml-auto text-right text-xs text-ink-subtle">
                <span className="block">{scopeLabel(row)}</span>
                <span className="block tabular-nums">
                  {/* Used / limit, because "12 used" means nothing without
                      the ceiling and a code at its ceiling is the one a
                      member will be told is invalid. */}
                  {row.usage_limit
                    ? t(locale, 'dc_used_of', { n: String(row.used_count), of: String(row.usage_limit) })
                    : t(locale, 'dc_used', { n: String(row.used_count) })}
                </span>
              </span>
              {!row.is_active && (
                <span className="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] text-ink-muted ring-1 ring-line">
                  {t(locale, 'dc_off')}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {(adding || editing) && (
        <DiscountCodeDialog
          locale={locale}
          code={editing}
          scopeOptions={scopeOptions}
          scopeAllLabel={t(locale, 'dc_everything')}
          chrome={{
            save: t(locale, 'save'),
            cancel: t(locale, 'cancel'),
            delete: t(locale, 'delete'),
            saving: t(locale, 'saving'),
            editTitle: (code) => t(locale, 'edit_item', { title: code }),
          }}
          onSave={async (draft: DiscountCodeDraft, id) => {
            // `scope_id` is the dialog's generic word for it; the API wants
            // to know WHICH kind of thing it is, which this page knows and
            // the shared dialog deliberately does not.
            const kind = scopeOptions.find((o) => o.value === draft.scope_id)?.kind;
            return saveDiscountCode(id, {
              ...draft,
              applies_to: draft.scope_id && kind ? kind : 'workspace',
              applies_to_id: draft.scope_id && kind ? draft.scope_id : null,
            });
          }}
          onDelete={removeDiscountCode}
          onClose={() => {
            setEditing(null);
            setAdding(false);
          }}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
