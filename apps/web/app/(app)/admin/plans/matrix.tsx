'use client';

// The tier matrix, editable. Plans as columns, functionality as rows grouped
// by app. Every cell edits the SAME billing_plan row the gates read, so what
// this page shows is what enforcement does — within the 60-second plan cache.
//
// Edits accumulate locally; one Save writes each changed plan. Feature keys
// are the deployed vocabulary (lib/plans.ts mirrors the API's PlanFeature
// union) — a new gate is a deploy, not a row here.

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FEATURE_GROUPS } from '@/lib/plans';
import { savePlan, type PlanPatch } from './actions';

export type AdminPlan = {
  id: string;
  name: string;
  price_cents_month: number;
  price_cents_year: number | null;
  included_seats: number | null;
  extra_seat_cents_month: number | null;
  included_emails_month: number | null;
  included_storage_gb: number | null;
  retention_months: number | null;
  meet_paid_pct: number;
  meet_paid_cap_cents: number | null;
  features: Record<string, boolean | number | null>;
  workspaces: { total: number; comped: number };
};

type NumericField =
  | 'price_cents_month'
  | 'price_cents_year'
  | 'included_seats'
  | 'extra_seat_cents_month'
  | 'included_emails_month'
  | 'included_storage_gb'
  | 'retention_months'
  | 'meet_paid_cap_cents';

export function PlanMatrix({ plans }: { plans: AdminPlan[] }) {
  const [edits, setEdits] = useState<Record<string, PlanPatch>>({});
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const merged = useMemo(
    () =>
      plans.map((p) => ({
        ...p,
        ...edits[p.id],
        features: { ...p.features, ...(edits[p.id]?.features ?? {}) },
      })),
    [plans, edits],
  );
  const dirty = Object.keys(edits).length > 0;

  function edit(planId: string, patch: Partial<PlanPatch>) {
    setSaved(false);
    setEdits((e) => ({ ...e, [planId]: { ...e[planId], ...patch } }));
  }
  function editFeature(planId: string, key: string, value: boolean | number | null) {
    setSaved(false);
    setEdits((e) => ({
      ...e,
      [planId]: { ...e[planId], features: { ...e[planId]?.features, [key]: value } },
    }));
  }

  function saveAll() {
    setError(null);
    start(async () => {
      for (const [id, patch] of Object.entries(edits)) {
        const r = await savePlan(id, patch);
        if (r.error) {
          setError(`${id}: ${r.error}`);
          return;
        }
      }
      setEdits({});
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex min-h-9 items-center justify-between gap-4">
        <p className="text-xs text-ink-muted">
          Changes apply to every workspace on the plan within a minute of saving.
        </p>
        <div className="flex items-center gap-3">
          {error && <span className="text-xs text-red-700">{error}</span>}
          {saved && !dirty && <span className="text-xs text-ink-muted">Saved.</span>}
          {dirty && (
            <>
              <Button variant="secondary" size="sm" onClick={() => setEdits({})} disabled={pending}>
                Discard
              </Button>
              <Button size="sm" onClick={saveAll} disabled={pending}>
                {pending ? 'Saving…' : 'Save changes'}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface-raised">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line text-left align-top">
              <th className="w-56 px-4 py-3 font-normal text-ink-muted" />
              {merged.map((p) => (
                <th key={p.id} className="px-4 py-3">
                  <div className="font-medium">{p.name}</div>
                  <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                    {p.id}
                  </div>
                  <div className="mt-1 text-xs font-normal text-ink-muted">
                    {p.workspaces.total} workspace{p.workspaces.total === 1 ? '' : 's'}
                    {p.workspaces.comped > 0 && ` · ${p.workspaces.comped} comped`}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <GroupRow label="Pricing" span={merged.length} />
            <EditableRow label="Monthly (€, ex-VAT)" plans={merged} render={(p) => (
              <EuroInput
                cents={p.price_cents_month}
                nullable={false}
                onChange={(v) => edit(p.id, { price_cents_month: v ?? 0 })}
              />
            )} />
            <EditableRow label="Yearly (€, ex-VAT)" plans={merged} render={(p) => (
              <EuroInput
                cents={p.price_cents_year}
                nullable
                placeholder="not sold"
                onChange={(v) => edit(p.id, { price_cents_year: v })}
              />
            )} />
            <GroupRow label="Allowances" span={merged.length} />
            <EditableRow label="Seats included" plans={merged} render={(p) => (
              <CountInput value={p.included_seats} placeholder="∞" onChange={(v) => edit(p.id, { included_seats: v })} />
            )} />
            <EditableRow label="Extra seat (€/month)" plans={merged} render={(p) => (
              <EuroInput cents={p.extra_seat_cents_month} nullable placeholder="—" onChange={(v) => edit(p.id, { extra_seat_cents_month: v })} />
            )} />
            <EditableRow label="Email / month" plans={merged} render={(p) => (
              <CountInput value={p.included_emails_month} placeholder="∞" onChange={(v) => edit(p.id, { included_emails_month: v })} />
            )} />
            <EditableRow label="Storage (GB)" plans={merged} render={(p) => (
              <CountInput value={p.included_storage_gb} placeholder="∞" onChange={(v) => edit(p.id, { included_storage_gb: v })} />
            )} />
            <EditableRow label="Data kept (months)" plans={merged} render={(p) => (
              <CountInput value={p.retention_months} placeholder="while paying" onChange={(v) => edit(p.id, { retention_months: v })} />
            )} />
            <GroupRow label="Fee on paid enrolments" span={merged.length} />
            <EditableRow label="Percentage" plans={merged} render={(p) => (
              <PctInput pct={p.meet_paid_pct} onChange={(v) => edit(p.id, { meet_paid_pct: v })} />
            )} />
            <EditableRow label="Cap per ticket (€)" plans={merged} render={(p) => (
              <EuroInput cents={p.meet_paid_cap_cents} nullable placeholder="no cap" onChange={(v) => edit(p.id, { meet_paid_cap_cents: v })} />
            )} />

            {FEATURE_GROUPS.map((g) => (
              <FeatureGroupRows
                key={g.app}
                app={g.app}
                rows={g.rows}
                plans={merged}
                onFlag={editFeature}
              />
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 max-w-2xl text-xs leading-relaxed text-ink-muted">
        This matrix edits the values of existing capabilities. Adding a <em>new</em> capability is a
        code change (a <code className="font-mono">PlanFeature</code> key plus its gate) — the same
        deliberate rule as app-key scopes. Fibre Meet is in every package by decision; only its fee
        ladder varies, above.
      </p>
    </div>
  );
}

function GroupRow({ label, span }: { label: string; span: number }) {
  return (
    <tr className="border-b border-line bg-surface-sunken/60">
      <td colSpan={span + 1} className="px-4 py-2 text-[10px] uppercase tracking-wider text-ink-muted">
        {label}
      </td>
    </tr>
  );
}

function EditableRow({
  label,
  plans,
  render,
}: {
  label: string;
  plans: AdminPlan[];
  render: (p: AdminPlan) => React.ReactNode;
}) {
  return (
    <tr className="border-b border-line/60">
      <td className="px-4 py-2 text-ink-subtle">{label}</td>
      {plans.map((p) => (
        <td key={p.id} className="px-4 py-2">
          {render(p)}
        </td>
      ))}
    </tr>
  );
}

function FeatureGroupRows({
  app,
  rows,
  plans,
  onFlag,
}: {
  app: string;
  rows: { key: string; label: string; kind: 'flag' | 'limit' }[];
  plans: AdminPlan[];
  onFlag: (planId: string, key: string, value: boolean | number | null) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <>
      <GroupRow label={app} span={plans.length} />
      {rows.map((row) => (
        <tr key={row.key} className="border-b border-line/60">
          <td className="px-4 py-2 text-ink-subtle">{row.label}</td>
          {plans.map((p) => {
            const v = p.features?.[row.key];
            return (
              <td key={p.id} className="px-4 py-2">
                {row.kind === 'flag' ? (
                  <input
                    type="checkbox"
                    checked={v === true}
                    onChange={(e) => onFlag(p.id, row.key, e.target.checked)}
                    className="h-4 w-4 accent-neutral-900 dark:accent-neutral-100"
                  />
                ) : (
                  <CountInput
                    value={typeof v === 'number' ? v : null}
                    placeholder="∞"
                    onChange={(n) => onFlag(p.id, row.key, n)}
                  />
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

const inputClass =
  'w-24 rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-line-strong';

/** Cents in the data, euros in the box. Empty = null when nullable. */
function EuroInput({
  cents,
  nullable,
  placeholder,
  onChange,
}: {
  cents: number | null;
  nullable: boolean;
  placeholder?: string;
  onChange: (cents: number | null) => void;
}) {
  return (
    <input
      type="number"
      min={0}
      step="0.01"
      className={inputClass}
      placeholder={placeholder}
      value={cents === null ? '' : cents / 100}
      onChange={(e) => {
        const raw = e.target.value.trim();
        if (raw === '') return onChange(nullable ? null : 0);
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) return;
        onChange(Math.round(n * 100));
      }}
    />
  );
}

function CountInput({
  value,
  placeholder,
  onChange,
}: {
  value: number | null;
  placeholder?: string;
  onChange: (v: number | null) => void;
}) {
  return (
    <input
      type="number"
      min={0}
      step={1}
      className={inputClass}
      placeholder={placeholder}
      value={value === null ? '' : value}
      onChange={(e) => {
        const raw = e.target.value.trim();
        if (raw === '') return onChange(null);
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 0) return;
        onChange(n);
      }}
    />
  );
}

/** 0.02 in the data, "2" in the box. */
function PctInput({ pct, onChange }: { pct: number; onChange: (pct: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        max={100}
        step="0.1"
        className={inputClass}
        value={Math.round(pct * 10000) / 100}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n) || n < 0 || n > 100) return;
          onChange(Math.round(n * 100) / 10000);
        }}
      />
      <span className="text-xs text-ink-muted">%</span>
    </div>
  );
}
