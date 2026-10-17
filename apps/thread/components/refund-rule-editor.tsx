'use client';

// The refund rule, edited (refund rules, slice 2, 2026-10-17; Sjoerd's
// answers A–G). Steps counted back from the thread's start — "at least 30
// days before: 100%; at least 7 days before: 50%; later: nothing" — and an
// optional fixed fee kept from any refund (A).
//
// ONE editor for both places it appears: Settings → Payments (the
// workspace's default) and a thread's Pricing (its own rule). The API's
// invalidRule is the validity rule; this form only stops the obvious before
// the save (a percentage over 100, two steps on one day).
//
// What it changes today: the refund QUOTE a participant and the organiser
// read. Refunding by the rule arrives with partial refunds; until then the
// approve dialog says so.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import type { Locale } from '@thefibre/shared';
import { t } from '@/lib/i18n-ui';
import { TextField, SelectField } from '@/components/ui/field';
import { Button } from '@/components/ui/button';

export type RefundStep = { until_days_before: number; refund_pct: number };
export type RefundRule = { steps: RefundStep[]; fee_cents?: number };

type Mode = 'inherit' | 'none' | 'own';

/** Steps from the furthest before the start to the closest. */
const ordered = (steps: RefundStep[]) => [...steps].sort((a, b) => b.until_days_before - a.until_days_before);

/** Why this rule cannot be saved, in the reader's words; null when fine. */
function problem(locale: Locale, steps: RefundStep[], fee: string): string | null {
  const days = new Set<number>();
  for (const s of steps) {
    if (!Number.isInteger(s.until_days_before) || s.until_days_before < 0) return t(locale, 'refund_rule_bad_days');
    if (!(s.refund_pct >= 0 && s.refund_pct <= 100)) return t(locale, 'refund_rule_bad_pct');
    if (days.has(s.until_days_before)) return t(locale, 'refund_rule_same_day');
    days.add(s.until_days_before);
  }
  if (fee.trim() && !(Number(fee) >= 0)) return t(locale, 'refund_rule_bad_fee');
  return null;
}

export function RefundRuleEditor({
  locale,
  scope,
  initial,
  onSave,
}: {
  locale: Locale;
  /** 'workspace': a rule or none. 'thread': the workspace's, none, or its own. */
  scope: 'workspace' | 'thread';
  /** As stored: null = no rule (workspace) / inherit (thread); {steps: []} = none. */
  initial: RefundRule | null;
  onSave: (rule: RefundRule | null) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const startMode: Mode = initial === null ? (scope === 'thread' ? 'inherit' : 'none') : initial.steps.length ? 'own' : 'none';
  const [mode, setMode] = useState<Mode>(startMode);
  const [steps, setSteps] = useState<RefundStep[]>(
    initial?.steps.length ? ordered(initial.steps) : [{ until_days_before: 30, refund_pct: 100 }, { until_days_before: 7, refund_pct: 50 }],
  );
  const [fee, setFee] = useState(initial?.fee_cents ? (initial.fee_cents / 100).toFixed(2) : '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const touch = () => setSaved(false);
  const setStep = (i: number, p: Partial<RefundStep>) => {
    setSteps((s) => s.map((x, j) => (j === i ? { ...x, ...p } : x)));
    touch();
  };

  function save() {
    setError(null);
    let rule: RefundRule | null;
    if (mode === 'inherit') rule = null;
    else if (mode === 'none') rule = scope === 'thread' ? { steps: [] } : null;
    else {
      const why = problem(locale, steps, fee);
      if (why) return setError(why);
      if (!steps.length) return setError(t(locale, 'refund_rule_need_step'));
      const feeCents = fee.trim() ? Math.round(Number(fee) * 100) : 0;
      rule = { steps: ordered(steps), ...(feeCents > 0 ? { fee_cents: feeCents } : {}) };
    }
    startTransition(async () => {
      const r = await onSave(rule);
      if (!r.ok) return setError(r.error);
      setSaved(true);
      router.refresh();
    });
  }

  const modeOptions =
    scope === 'thread'
      ? [
          { value: 'inherit', label: t(locale, 'refund_rule_inherit') },
          { value: 'none', label: t(locale, 'refund_rule_none_thread') },
          { value: 'own', label: t(locale, 'refund_rule_own') },
        ]
      : [
          { value: 'none', label: t(locale, 'refund_rule_none') },
          { value: 'own', label: t(locale, 'refund_rule_own_workspace') },
        ];

  return (
    <div className="max-w-xl space-y-3">
      <SelectField
        label={t(locale, 'refund_rule_label')}
        value={mode}
        onChange={(e) => {
          setMode(e.target.value as Mode);
          touch();
        }}
        options={modeOptions}
      />

      {mode === 'own' && (
        <>
          <ul className="space-y-2">
            {steps.map((s, i) => (
              <li key={i} className="flex items-end gap-2">
                <div className="w-40">
                  <TextField
                    label={t(locale, 'refund_rule_days')}
                    type="number"
                    min={0}
                    step={1}
                    value={String(s.until_days_before)}
                    onChange={(e) => setStep(i, { until_days_before: Math.trunc(Number(e.target.value)) })}
                  />
                </div>
                <div className="w-32">
                  <TextField
                    label={t(locale, 'refund_rule_pct')}
                    type="number"
                    min={0}
                    max={100}
                    value={String(s.refund_pct)}
                    onChange={(e) => setStep(i, { refund_pct: Number(e.target.value) })}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  aria-label={t(locale, 'refund_rule_remove_step')}
                  onClick={() => {
                    setSteps((x) => x.filter((_, j) => j !== i));
                    touch();
                  }}
                >
                  <Trash2 size={15} strokeWidth={1.75} />
                </Button>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="secondary"
            disabled={steps.length >= 10}
            onClick={() => {
              const last = ordered(steps).at(-1);
              setSteps((x) => [...x, { until_days_before: Math.max(0, (last?.until_days_before ?? 14) - 7), refund_pct: 0 }]);
              touch();
            }}
          >
            <Plus size={15} strokeWidth={1.75} /> {t(locale, 'refund_rule_add_step')}
          </Button>
          <p className="text-xs text-ink-subtle">{t(locale, 'refund_rule_after_last')}</p>
          <div className="w-48">
            <TextField
              label={t(locale, 'refund_rule_fee')}
              hint={t(locale, 'refund_rule_fee_hint')}
              type="number"
              min={0}
              step="0.01"
              value={fee}
              onChange={(e) => {
                setFee(e.target.value);
                touch();
              }}
            />
          </div>
        </>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" variant="save" disabled={pending} onClick={save}>
          {pending ? t(locale, 'saving') : t(locale, 'save')}
        </Button>
        {saved && <span className="text-xs text-ink-subtle">{t(locale, 'saved')}</span>}
        {error && <span className="text-xs text-red-700">{error}</span>}
      </div>
    </div>
  );
}
