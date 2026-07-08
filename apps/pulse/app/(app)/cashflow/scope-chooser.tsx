'use client';

// The entry chooser (Sjoerd 2026-07-09: "in Cashflow... you have to select
// which one you're opening if it exists: me (personal), team (select if you
// have access) or workspace (when you have access)"). Rendered by page.tsx
// when the URL carries no scope AND no scope cookie is stored — first visit,
// or after "Switch cashflow" cleared the cookie. A card click stores the
// cookie (same savePref the header switcher uses) and navigates to the
// scoped URL; the existing scope wiring takes over from there.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, UserRound, Users, type LucideIcon } from 'lucide-react';
import { savePref } from '@/lib/prefs-actions';
import { COOKIE_CASHFLOW_SCOPE } from '@/lib/prefs-shared';

export function ScopeChooser({
  teams,
  canWorkspace,
}: {
  // INVOLVED teams the caller can see (RLS-scoped involved-teams fetch).
  teams: { id: string; name: string }[];
  // The projection fetch succeeded = admin — only then offer Workspace.
  canWorkspace: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function choose(cookieVal: string, url: string) {
    if (busy) return;
    setBusy(true);
    await savePref(COOKIE_CASHFLOW_SCOPE, cookieVal); // remembered per user
    router.push(url);
    // The Workspace card's target IS the current URL (bare /cashflow) —
    // push alone won't re-render the server component; refresh re-reads
    // the cookie and swaps the chooser for the grid.
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl py-14 text-center">
      <h1 className="text-[28px] font-semibold tracking-tight text-ink">Cashflow</h1>
      <p className="mt-1 text-sm text-ink-muted">Which cashflow do you want to open?</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <ChooserCard
          Icon={UserRound}
          title="My cashflow"
          desc="Income and costs you own."
          disabled={busy}
          onClick={() => choose('me', '/cashflow?scope=me')}
        />
        {teams.map((t) => (
          <ChooserCard
            key={t.id}
            Icon={Users}
            title={t.name}
            desc="This team's income and costs."
            disabled={busy}
            onClick={() => choose(`team:${t.id}`, `/cashflow?team=${t.id}`)}
          />
        ))}
        {canWorkspace && (
          <ChooserCard
            Icon={Building2}
            title="Workspace"
            desc="Everything — the whole workspace's picture."
            disabled={busy}
            onClick={() => choose('workspace', '/cashflow')}
          />
        )}
      </div>
      <p className="mt-6 text-xs text-ink-muted">
        Your choice is remembered — switch any time from the Cashflow header.
      </p>
    </div>
  );
}

function ChooserCard({
  Icon,
  title,
  desc,
  onClick,
  disabled,
}: {
  Icon: LucideIcon;
  title: string;
  desc: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-start gap-3.5 rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-5 text-left transition-shadow hover:ring-line-strong hover:shadow-md disabled:opacity-60"
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-surface-sunken ring-1 ring-line shrink-0">
        <Icon size={18} strokeWidth={1.75} className="text-ink-subtle" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{title}</span>
        <span className="mt-0.5 block text-xs text-ink-muted leading-relaxed">{desc}</span>
      </span>
    </button>
  );
}
