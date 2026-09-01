import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  SectionLabel,
  EmptyState,
  ErrorBanner,
} from '@/components/ui/page';

type Me = {
  user: { full_name: string | null; email: string };
  workspace: { id: string; name: string; plan: string } | null;
};

export default async function ThreadDashboard() {
  let me: Me | null = null;
  let error: string | null = null;
  try {
    me = await apiFetch<Me>('/api/v1/auth/me');
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
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
    <PageContainer>
      <PageHeader
        title={`Welcome to Thread, ${firstName}`}
        description={today}
      />

      {error && <ErrorBanner>Couldn&apos;t load: {error}</ErrorBanner>}

      <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-10">
        <div>
          <SectionLabel>What lives here</SectionLabel>
          <ul className="mt-3 space-y-3 text-sm text-ink-subtle leading-relaxed">
            <li>· Conferences and multi-session programmes</li>
            <li>· Post-event journeys — the arc that follows a gathering</li>
            <li>· Enrolment state per participant</li>
            <li>· Session-level attendance + milestones</li>
          </ul>
        </div>
        <div>
          <SectionLabel>What stays on The Fibre</SectionLabel>
          <p className="mt-3 text-sm text-ink-subtle leading-relaxed">
            Identity (the person, the organisation), the platform activity
            log, and shared programme/enrolment state. Curator data tagged for
            Thread also lives on The Fibre but is only visible to Thread
            members.
          </p>
        </div>
      </section>

      <section className="mt-14">
        <EmptyState>
          Skeleton. Programme creation, session attendance tracking, and the
          public arc view come next.
        </EmptyState>
      </section>
    </PageContainer>
  );
}
