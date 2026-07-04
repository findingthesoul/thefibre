'use client';

// Team settings (Sjoerd 2026-07-04): a team is more than names + members —
// description and, crucially, WHERE its money lands: the workspace account
// (default) or the team lead's personal account. Editable by the team lead
// and workspace admins (the API enforces it).

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, User } from 'lucide-react';
import { updateTeam } from './settings-actions';
import { SectionLabel } from '@/components/ui/page';
import { Button } from '@/components/ui/button';

export function TeamSettings({
  teamId,
  description: initialDescription,
  payoutDestination: initialPayout,
  leadName,
}: {
  teamId: string;
  description: string | null;
  payoutDestination: 'workspace' | 'lead';
  leadName: string | null;
}) {
  const router = useRouter();
  const [description, setDescription] = useState(initialDescription ?? '');
  const [payout, setPayout] = useState<'workspace' | 'lead'>(initialPayout);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const r = await updateTeam(teamId, {
        description: description.trim() || null,
        payout_destination: payout,
      });
      if (!r.ok) return setError(r.error);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <section className="mt-10">
      <SectionLabel>Team settings</SectionLabel>
      <form onSubmit={onSubmit} className="mt-3 space-y-4 max-w-2xl">
        <label className="block">
          <span className="text-xs text-ink-subtle">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="What this team is for — shown on the team's public page."
            className="mt-1 w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:border-line-strong focus:outline-none placeholder:text-ink-muted"
          />
        </label>

        <div>
          <span className="text-xs text-ink-subtle">Payments from this team&apos;s threads go to</span>
          <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPayout('workspace')}
              className={`text-left rounded-lg border p-3.5 transition-colors ${
                payout === 'workspace'
                  ? 'border-ink bg-surface-sunken'
                  : 'border-line bg-surface hover:bg-surface-sunken'
              }`}
            >
              <div className="flex items-center gap-2">
                <Building2 size={15} strokeWidth={1.75} className="text-ink-subtle" />
                <span className="text-sm font-medium">Workspace account</span>
              </div>
              <p className="mt-1 text-xs text-ink-subtle leading-relaxed">
                The workspace&apos;s Stripe account and invoice identity (default).
              </p>
            </button>
            <button
              type="button"
              onClick={() => setPayout('lead')}
              className={`text-left rounded-lg border p-3.5 transition-colors ${
                payout === 'lead'
                  ? 'border-ink bg-surface-sunken'
                  : 'border-line bg-surface hover:bg-surface-sunken'
              }`}
            >
              <div className="flex items-center gap-2">
                <User size={15} strokeWidth={1.75} className="text-ink-subtle" />
                <span className="text-sm font-medium">
                  Team lead&apos;s account{leadName ? ` — ${leadName}` : ''}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-subtle leading-relaxed">
                The lead&apos;s personal Stripe account (Settings → Payments → My account).
              </p>
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
          {saved && <span className="text-xs text-ink-subtle">Saved.</span>}
        </div>
      </form>
    </section>
  );
}
