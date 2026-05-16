import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, PageHeader, SectionLabel, EmptyState, ErrorBanner } from '@/components/ui/page';
import { ListGroup, ListRow } from '@/components/ui/list';
import { RevokeButton, ErasureButton, ExportButton } from './buttons';

type Consent = {
  id: string;
  purpose_code: string;
  legal_basis: string;
  granted_at: string;
  revoked_at: string | null;
  text_version: string | null;
};

type Request = {
  id: string;
  type: string;
  status: string;
  requested_at: string;
  due_at: string;
  completed_at: string | null;
  notes: string | null;
};

const PURPOSE_LABEL: Record<string, string> = {
  transactional_email: 'Transactional email',
  marketing_email: 'Marketing email',
  learning_analytics: 'Learning analytics',
  cohort_directory: 'Cohort directory visibility',
  facilitation_data: 'Facilitation data',
  sales_contact: 'Sales contact',
};

const PURPOSE_DESC: Record<string, string> = {
  transactional_email: 'Sign-in links, invitations, and notifications. Required for the platform to work.',
  marketing_email: 'Newsletters and programme announcements.',
  learning_analytics: 'Progress tracking and completion data inside learning programmes.',
  cohort_directory: 'Showing your name to other participants inside cohort views.',
  facilitation_data: 'Recording attendance and session notes during programmes.',
  sales_contact: 'Outreach and pipeline communication.',
};

const STATUS_LABEL: Record<string, string> = {
  received: 'Received',
  in_progress: 'In progress',
  completed: 'Completed',
  rejected: 'Rejected',
};

export default async function PrivacyPage() {
  let consents: Consent[] = [];
  let requests: Request[] = [];
  let error: string | null = null;
  try {
    const [c, r] = await Promise.all([
      apiFetch<{ items: Consent[] }>('/api/v1/privacy/consent'),
      apiFetch<{ items: Request[] }>('/api/v1/privacy/requests'),
    ]);
    consents = c.items;
    requests = r.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  // Reduce to current state per purpose: most recent grant wins, revoked_at = null = active.
  const byPurpose = new Map<string, Consent>();
  for (const c of consents) {
    const existing = byPurpose.get(c.purpose_code);
    if (!existing || new Date(c.granted_at) > new Date(existing.granted_at)) {
      byPurpose.set(c.purpose_code, c);
    }
  }
  const currentConsents = Array.from(byPurpose.values()).sort((a, b) =>
    a.purpose_code.localeCompare(b.purpose_code),
  );

  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Privacy"
        description="Your data, your consents, your rights. EU-hosted, GDPR-native."
      />

      {error && <ErrorBanner>Couldn't load privacy data: {error}</ErrorBanner>}

      <section className="mt-12">
        <SectionLabel>Active consents</SectionLabel>
        {currentConsents.length === 0 ? (
          <EmptyState>
            No consent records yet. Consents are recorded when you grant permissions during sign-up or in app flows.
          </EmptyState>
        ) : (
          <ListGroup>
            {currentConsents.map((c) => {
              const active = !c.revoked_at;
              return (
                <ListRow
                  key={c.id}
                  primary={PURPOSE_LABEL[c.purpose_code] ?? c.purpose_code}
                  secondary={PURPOSE_DESC[c.purpose_code] ?? c.legal_basis}
                  meta={
                    <span className={active ? 'text-emerald-700' : 'text-ink-muted'}>
                      {active ? 'Active' : `Revoked ${new Date(c.revoked_at!).toLocaleDateString('en-GB')}`}
                    </span>
                  }
                  trailing={
                    active && c.legal_basis === 'consent' ? (
                      <RevokeButton purposeCode={c.purpose_code} label={PURPOSE_LABEL[c.purpose_code] ?? c.purpose_code} />
                    ) : undefined
                  }
                />
              );
            })}
          </ListGroup>
        )}
        <p className="mt-3 text-xs text-ink-muted">
          Consents granted under <span className="font-mono">contract</span> or{' '}
          <span className="font-mono">legitimate_interest</span> can be objected to but not revoked unilaterally — the
          underlying record stays.
        </p>
      </section>

      <section className="mt-14">
        <SectionLabel>Data subject requests</SectionLabel>
        {requests.length === 0 ? (
          <EmptyState>No requests filed. Use the actions below to file one.</EmptyState>
        ) : (
          <ListGroup>
            {requests.map((r) => (
              <ListRow
                key={r.id}
                primary={r.type.charAt(0).toUpperCase() + r.type.slice(1)}
                secondary={`Filed ${new Date(r.requested_at).toLocaleString('en-GB', {
                  dateStyle: 'medium',
                })} · Due ${new Date(r.due_at).toLocaleDateString('en-GB')}`}
                meta={STATUS_LABEL[r.status] ?? r.status}
              />
            ))}
          </ListGroup>
        )}
      </section>

      <section className="mt-14">
        <SectionLabel>Actions</SectionLabel>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <ActionCard
            title="Export my data"
            description="GDPR Article 15. Download everything we hold about you as JSON — identity, profile, org memberships, activity, bookings, per-app curator data, consents and cross-app links."
            footer={<ExportButton />}
          />
          <ActionCard
            title="Request erasure"
            description="GDPR Article 17. We zero personal content fields across every app within 30 days."
            footer={<ErasureButton />}
          />
        </div>
      </section>
    </PageContainer>
  );
}

function ActionCard({
  title,
  description,
  footer,
}: {
  title: string;
  description: string;
  footer: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface-raised p-5">
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1 text-sm text-ink-subtle">{description}</p>
      <div className="mt-4">{footer}</div>
    </div>
  );
}
