import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  ErrorBanner,
  SectionLabel,
} from '@/components/ui/page';
import { InviteForm } from './invite';

type Member = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  email_verified: boolean;
  has_meet: boolean;
};

export default async function InternalTeamPage() {
  let items: Member[] = [];
  let error: string | null = null;
  try {
    const r = await apiFetch<{ items: Member[] }>('/api/v1/meet/internal-team');
    items = r.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Internal team"
        description="Workspace members who can sign in to Fibre Meet. External collaborators don't live here — add them per team."
      />

      {error && <ErrorBanner>Couldn&apos;t load: {error}</ErrorBanner>}

      <section className="mt-10">
        <SectionLabel>Internal team ({items.length})</SectionLabel>
        <p className="mt-1 text-sm text-ink-subtle">
          Everyone who can sign in to Fibre Meet.
        </p>
        <ul className="mt-4 rounded-lg border border-line bg-surface-raised divide-y divide-line overflow-hidden">
          {items.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-4 px-5 py-4 text-sm"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {m.full_name ?? m.email}
                </div>
                <div className="mt-0.5 text-xs text-ink-muted truncate">
                  {m.email}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-[10px] uppercase tracking-wider">
                {!m.email_verified && (
                  <span className="text-ink-muted border border-line rounded px-1.5 py-0.5">
                    Pending
                  </span>
                )}
                {m.has_meet ? (
                  <span className="text-ink-muted">Member</span>
                ) : (
                  <span className="text-ink-muted border border-line rounded px-1.5 py-0.5">
                    No Meet
                  </span>
                )}
              </div>
            </li>
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
