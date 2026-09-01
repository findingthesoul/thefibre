'use client';

// The invited-in door. A signup request is the door for people who ask;
// this button is the door for organisations we invite — a social enterprise
// being given a workspace, with its plan, comp or tailored price set in the
// same breath. The person still signs in with their own email afterwards.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { createWorkspace } from './actions';
import type { PlanOption } from './list';

export function NewWorkspaceButton({ plans }: { plans: PlanOption[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [planId, setPlanId] = useState('free');
  const [comped, setComped] = useState(false);
  const [reason, setReason] = useState('');
  const [customMonth, setCustomMonth] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function reset() {
    setName('');
    setPlanId('free');
    setComped(false);
    setReason('');
    setCustomMonth('');
    setError(null);
  }

  function create() {
    setError(null);
    if (!name.trim()) {
      setError('A workspace needs a name.');
      return;
    }
    let month: number | null = null;
    if (customMonth.trim() !== '') {
      const n = Number(customMonth.replace(',', '.'));
      if (!Number.isFinite(n) || n < 0) {
        setError('The tailored price must be a number (euros).');
        return;
      }
      month = Math.round(n * 100);
    }
    start(async () => {
      const r = await createWorkspace({
        name: name.trim(),
        plan_id: planId,
        comped,
        comped_reason: comped ? (reason.trim() || null) : null,
        custom_price_cents_month: month,
      });
      if (r.error) {
        setError(r.error);
      } else {
        setOpen(false);
        reset();
        router.refresh();
      }
    });
  }

  const field =
    'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-line-strong';

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        New workspace
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New workspace"
        description="For an organisation you are inviting in yourself. They sign in with their own email once you tell them it exists — nothing is emailed automatically."
        footer={
          <>
            {error && <span className="mr-auto text-xs text-red-700">{error}</span>}
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={create} disabled={pending}>
              {pending ? 'Creating…' : 'Create workspace'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="text-ink-subtle">Name</span>
            <input
              className={`${field} mt-1`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weaving Futures Coöperatie"
              autoFocus
            />
          </label>
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
              On the house <span className="text-ink-muted">— pays nothing, keeps the plan&rsquo;s features</span>
            </span>
          </label>
          {comped ? (
            <label className="block text-sm">
              <span className="text-ink-subtle">Why</span>
              <input
                className={`${field} mt-1`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. social enterprise — founding cohort"
              />
            </label>
          ) : (
            <label className="block text-sm">
              <span className="text-ink-subtle">Tailored €/month (empty = list price)</span>
              <input
                className={`${field} mt-1`}
                inputMode="decimal"
                value={customMonth}
                onChange={(e) => setCustomMonth(e.target.value)}
                placeholder="list price"
              />
            </label>
          )}
        </div>
      </Dialog>
    </>
  );
}
