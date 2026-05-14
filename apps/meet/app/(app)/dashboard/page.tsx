import { apiFetch } from '@/lib/api';

type Me = {
  user: { full_name: string | null; email: string };
  workspace: { id: string; name: string; plan: string } | null;
};

export default async function MeetDashboard() {
  let me: Me | null = null;
  try {
    me = await apiFetch<Me>('/api/v1/auth/me');
  } catch {
    // Layout already gated; if we land here without /me, fall through to placeholder.
  }

  const firstName =
    me?.user.full_name?.split(/\s+/)[0] ?? me?.user.email?.split('@')[0] ?? '';

  const today = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="mx-auto max-w-5xl px-8 py-12">
      <h1 className="text-3xl font-medium tracking-tight">
        Welcome to Meet, {firstName}
      </h1>
      <p className="mt-1 text-sm text-ink-subtle">{today}</p>

      <section className="mt-12">
        <div className="text-[10px] uppercase tracking-wider text-ink-muted">
          Workspace
        </div>
        <div className="mt-3 rounded-lg border border-line bg-surface-raised p-5">
          <div className="font-medium">{me?.workspace?.name ?? '—'}</div>
          <div className="text-xs text-ink-muted mt-1">
            plan: {me?.workspace?.plan ?? '—'}
          </div>
        </div>
      </section>

      <section className="mt-12">
        <div className="text-[10px] uppercase tracking-wider text-ink-muted">
          What lives here
        </div>
        <ul className="mt-3 space-y-3 text-sm text-ink-subtle leading-relaxed">
          <li>
            · The agenda — designed before, run during, captured after
          </li>
          <li>· Outcomes, decisions, and action items per session</li>
          <li>· Facilitator observations and contribution notes</li>
          <li>· Exercise responses (private to the facilitator)</li>
        </ul>
      </section>

      <section className="mt-12">
        <div className="text-[10px] uppercase tracking-wider text-ink-muted">
          What stays on The Fibre
        </div>
        <p className="mt-3 text-sm text-ink-subtle leading-relaxed max-w-2xl">
          Identity (the person, the organisation) and the activity log (this
          meeting happened, on this date, with these people). Curator data
          tagged for Fibre Meet — change context, system context — also lives
          on The Fibre but is only visible to Meet members.
        </p>
      </section>

      <section className="mt-14">
        <div className="rounded-lg border border-line bg-surface-sunken p-6">
          <div className="text-xs uppercase tracking-wider text-ink-muted">
            Skeleton
          </div>
          <p className="mt-2 text-sm">
            This is the scaffold for Fibre Meet. Programmes, sessions,
            agendas and the facilitator UI port over from Suite next.
          </p>
        </div>
      </section>
    </div>
  );
}
