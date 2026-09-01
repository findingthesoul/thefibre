import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  ErrorBanner,
  SectionLabel,
} from '@/components/ui/page';
import { InviteForm } from './invite';
import { MemberRow, type Member } from './row';

export default async function InternalTeamPage() {
  let items: Member[] = [];
  let me: { user: { id: string } } | null = null;
  let error: string | null = null;
  try {
    [items, me] = await Promise.all([
      apiFetch<{ items: Member[] }>('/api/v1/meet/internal-team').then((r) => r.items),
      apiFetch<{ user: { id: string } }>('/api/v1/auth/me').catch(() => null),
    ]);
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }
  const meId = me?.user.id ?? null;
  const meRow = items.find((m) => m.id === meId);
  const iAmAdmin =
    meRow?.workspace_role === 'admin' || meRow?.workspace_role === 'super_admin';

  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Internal team"
        description="Workspace members who can sign in to Meet. External collaborators don't live here — add them per team."
      />

      {/* Transition notice: membership management is moving to the platform
          (docs/platform-spot-members-profile.md). This page is retired next. */}
      <a
        href="https://thefibre.app/settings/members"
        target="_blank"
        rel="noreferrer"
        className="mt-4 flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-ink hover:border-yellow-400 transition-colors"
      >
        Members are now managed centrally in <span className="font-medium">The Fibre</span> →
        Settings → Members. This page still works, but moves there next release.
      </a>

      {error && <ErrorBanner>Couldn&apos;t load: {error}</ErrorBanner>}

      <section className="mt-10">
        <SectionLabel>Internal team ({items.length})</SectionLabel>
        <p className="mt-1 text-sm text-ink-subtle">
          Everyone who can sign in to Meet. Admins can change roles and
          relationship types.
        </p>
        <ul className="mt-4 rounded-lg border border-line bg-surface-raised divide-y divide-line overflow-hidden">
          {items.map((m) => (
            <MemberRow key={m.id} member={m} editable={iAmAdmin && m.id !== meId} />
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <SectionLabel>Invite a member</SectionLabel>
        <p className="mt-1 text-sm text-ink-subtle">
          They&apos;ll get an email with a link to sign in with Google.
        </p>
        <div className="mt-4">
          <InviteForm />
        </div>
      </section>
    </PageContainer>
  );
}
