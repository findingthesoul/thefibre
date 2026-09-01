'use client';

// The tenant list, with each workspace's REAL plan (workspace_subscription,
// not the legacy workspace.plan text column) and the controls that make
// tailored deals possible: move plan, comp with a written reason, or set a
// custom price. Feature gates always follow the plan; the price is only what
// the workspace pays.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { eur } from '@/lib/plans';
import { saveSubscription } from './actions';

export type Subscription = {
  plan_id: string;
  plan_name: string;
  status: string;
  comped_reason: string | null;
  comped_until: string | null;
  custom_price_cents_month: number | null;
  custom_price_cents_year: number | null;
  list_price_cents_month: number;
};

export type Workspace = {
  id: string;
  slug: string;
  name: string;
  created_at: string;
  subscription: Subscription | null;
  counts: {
    users: number;
    people: number;
    organisations: number;
    activities: number;
    apps: number;
  };
  is_empty: boolean;
  is_yours: boolean;
};

export type PlanOption = { id: string; name: string };

export function WorkspaceList({ items, plans }: { items: Workspace[]; plans: PlanOption[] }) {
  const [editing, setEditing] = useState<Workspace | null>(null);

  if (items.length === 0) {
    return <EmptyState>No workspaces. That should be impossible — check the API log.</EmptyState>;
  }
  return (
    <>
      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface-raised">
        {items.map((w) => (
          <li key={w.id} className="px-5 py-4">
            <div className="flex items-baseline justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="truncate font-medium">{w.name}</span>
                  {w.is_yours && (
                    <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                      Yours
                    </span>
                  )}
                  {w.is_empty && (
                    <span className="shrink-0 rounded-full border border-amber-600/40 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-700 dark:border-amber-400/40 dark:text-amber-400">
                      Empty
                    </span>
                  )}
                </div>
                <div className="mt-0.5 font-mono text-xs text-ink-muted">{w.slug}</div>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <div className="text-right text-xs text-ink-muted">
                  <PlanBadge sub={w.subscription} />
                  <div className="mt-0.5">
                    {new Date(w.created_at).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setEditing(w)}>
                  Plan…
                </Button>
              </div>
            </div>

            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-muted">
              <Count label="Users" value={w.counts.users} />
              <Count label="Contacts" value={w.counts.people} />
              <Count label="Organisations" value={w.counts.organisations} />
              <Count label="Activity" value={w.counts.activities} />
              <Count label="Apps on" value={w.counts.apps} />
            </dl>
          </li>
        ))}
      </ul>

      {editing && (
        <SubscriptionDialog workspace={editing} plans={plans} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function PlanBadge({ sub }: { sub: Subscription | null }) {
  if (!sub) return <div className="uppercase tracking-wider">no subscription</div>;
  const price =
    sub.status === 'comped'
      ? 'comped'
      : eur(sub.custom_price_cents_month ?? sub.list_price_cents_month) + '/mo';
  return (
    <div>
      <span className="uppercase tracking-wider text-ink">{sub.plan_name}</span>
      <span> · {price}</span>
      {sub.custom_price_cents_month !== null && sub.status !== 'comped' && (
        <span className="ml-1 rounded-full border border-line px-1.5 py-px text-[10px] uppercase tracking-wider">
          tailored
        </span>
      )}
    </div>
  );
}

function SubscriptionDialog({
  workspace,
  plans,
  onClose,
}: {
  workspace: Workspace;
  plans: PlanOption[];
  onClose: () => void;
}) {
  const sub = workspace.subscription;
  const [planId, setPlanId] = useState(sub?.plan_id ?? 'free');
  const [comped, setComped] = useState(sub?.status === 'comped');
  const [reason, setReason] = useState(sub?.comped_reason ?? '');
  const [customMonth, setCustomMonth] = useState(
    sub?.custom_price_cents_month === null || sub?.custom_price_cents_month === undefined
      ? ''
      : String(sub.custom_price_cents_month / 100),
  );
  const [customYear, setCustomYear] = useState(
    sub?.custom_price_cents_year === null || sub?.custom_price_cents_year === undefined
      ? ''
      : String(sub.custom_price_cents_year / 100),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function parseEuros(raw: string): number | null | undefined {
    const t = raw.trim();
    if (t === '') return null;
    const n = Number(t.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) return undefined; // invalid
    return Math.round(n * 100);
  }

  function save() {
    setError(null);
    const month = parseEuros(customMonth);
    const year = parseEuros(customYear);
    if (month === undefined || year === undefined) {
      setError('Prices must be numbers (euros).');
      return;
    }
    start(async () => {
      const r = await saveSubscription(workspace.id, {
        plan_id: planId,
        comped,
        comped_reason: comped ? (reason.trim() || null) : null,
        custom_price_cents_month: month,
        custom_price_cents_year: year,
      });
      if (r.error) {
        setError(r.error);
      } else {
        onClose();
        router.refresh();
      }
    });
  }

  const field =
    'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-line-strong';

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Plan for ${workspace.name}`}
      description="Gates follow the plan. Comps and tailored prices only change what the workspace pays — Settings → Plan shows them their effective price."
      footer={
        <>
          {error && <span className="mr-auto text-xs text-red-700">{error}</span>}
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="text-ink-subtle">Plan</span>
          <select className={`${field} mt-1`} value={planId} onChange={(e) => setPlanId(e.target.value)}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={comped}
            onChange={(e) => setComped(e.target.checked)}
            className="h-4 w-4 accent-neutral-900 dark:accent-neutral-100"
          />
          <span>
            On the house{' '}
            <span className="text-ink-muted">— pays nothing, keeps the plan&rsquo;s features</span>
          </span>
        </label>

        {comped && (
          <label className="block text-sm">
            <span className="text-ink-subtle">Why (written next to it, for the audit trail)</span>
            <input
              className={`${field} mt-1`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. social enterprise — founding cohort"
            />
          </label>
        )}

        {!comped && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-ink-subtle">Tailored €/month</span>
              <input
                className={`${field} mt-1`}
                inputMode="decimal"
                value={customMonth}
                onChange={(e) => setCustomMonth(e.target.value)}
                placeholder="list price"
              />
            </label>
            <label className="block text-sm">
              <span className="text-ink-subtle">Tailored €/year</span>
              <input
                className={`${field} mt-1`}
                inputMode="decimal"
                value={customYear}
                onChange={(e) => setCustomYear(e.target.value)}
                placeholder="list price"
              />
            </label>
            <p className="col-span-2 text-xs text-ink-muted">
              Leave empty to charge the plan&rsquo;s list price. A tailored price is the lever for
              &ldquo;the same package, at their price&rdquo; — a social enterprise on Pro at €25, say.
            </p>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="uppercase tracking-wider">{label}</dt>
      {/* -1 means the count query itself failed. Say so rather than show a
          confident zero — on this page a false zero is the one wrong answer,
          because zero is exactly what "safe to delete" looks like. */}
      <dd className={`font-mono ${value > 0 ? 'text-ink' : ''}`}>{value < 0 ? '?' : value}</dd>
    </div>
  );
}
