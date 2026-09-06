import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, PageHeader, SectionLabel, EmptyState, ErrorBanner } from '@/components/ui/page';
import { ListGroup, ListRow } from '@/components/ui/list';
import { uiLocale } from '@/lib/locale';
import { t, INTL_LOCALES, type UiKey } from '@/lib/i18n-ui';
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

const PURPOSE_LABEL: Record<string, UiKey> = {
  transactional_email: 'purpose_transactional_email',
  marketing_email: 'purpose_marketing_email',
  learning_analytics: 'purpose_learning_analytics',
  cohort_directory: 'purpose_cohort_directory',
  facilitation_data: 'purpose_facilitation_data',
  sales_contact: 'purpose_sales_contact',
};

const PURPOSE_DESC: Record<string, UiKey> = {
  transactional_email: 'purpose_transactional_email_desc',
  marketing_email: 'purpose_marketing_email_desc',
  learning_analytics: 'purpose_learning_analytics_desc',
  cohort_directory: 'purpose_cohort_directory_desc',
  facilitation_data: 'purpose_facilitation_data_desc',
  sales_contact: 'purpose_sales_contact_desc',
};

const STATUS_LABEL: Record<string, UiKey> = {
  received: 'status_received',
  in_progress: 'status_in_progress',
  completed: 'status_request_completed',
  rejected: 'status_rejected',
};

export default async function PrivacyPage() {
  const locale = await uiLocale();
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
        title={t(locale, 'nav_privacy')}
        description={t(locale, 'privacy_blurb')}
      />

      {error && <ErrorBanner>{t(locale, 'privacy_load_failed')} {error}</ErrorBanner>}

      <section className="mt-12">
        <SectionLabel>{t(locale, 'active_consents')}</SectionLabel>
        {currentConsents.length === 0 ? (
          <EmptyState>{t(locale, 'no_consents_yet')}</EmptyState>
        ) : (
          <ListGroup>
            {currentConsents.map((c) => {
              const active = !c.revoked_at;
              return (
                <ListRow
                  key={c.id}
                  primary={
                    PURPOSE_LABEL[c.purpose_code]
                      ? t(locale, PURPOSE_LABEL[c.purpose_code]!)
                      : c.purpose_code
                  }
                  secondary={
                    PURPOSE_DESC[c.purpose_code]
                      ? t(locale, PURPOSE_DESC[c.purpose_code]!)
                      : c.legal_basis
                  }
                  meta={
                    <span className={active ? 'text-emerald-700' : 'text-ink-muted'}>
                      {active
                        ? t(locale, 'consent_active')
                        : `${t(locale, 'revoked_at')} ${new Date(c.revoked_at!).toLocaleDateString(INTL_LOCALES[locale])}`}
                    </span>
                  }
                  trailing={
                    active && c.legal_basis === 'consent' ? (
                      <RevokeButton
                        purposeCode={c.purpose_code}
                        label={
                          PURPOSE_LABEL[c.purpose_code]
                            ? t(locale, PURPOSE_LABEL[c.purpose_code]!)
                            : c.purpose_code
                        }
                        locale={locale}
                      />
                    ) : undefined
                  }
                />
              );
            })}
          </ListGroup>
        )}
        <p className="mt-3 text-xs text-ink-muted">
          {t(locale, 'consent_basis_note_pre')} <span className="font-mono">contract</span>{' '}
          {t(locale, 'or')} <span className="font-mono">legitimate_interest</span>{' '}
          {t(locale, 'consent_basis_note_post')}
        </p>
      </section>

      <section className="mt-14">
        <SectionLabel>{t(locale, 'data_subject_requests')}</SectionLabel>
        {requests.length === 0 ? (
          <EmptyState>{t(locale, 'no_requests_filed')}</EmptyState>
        ) : (
          <ListGroup>
            {requests.map((r) => (
              <ListRow
                key={r.id}
                primary={r.type.charAt(0).toUpperCase() + r.type.slice(1)}
                secondary={`${t(locale, 'filed')} ${new Date(r.requested_at).toLocaleString(
                  INTL_LOCALES[locale],
                  { dateStyle: 'medium' },
                )} · ${t(locale, 'due')} ${new Date(r.due_at).toLocaleDateString(INTL_LOCALES[locale])}`}
                meta={STATUS_LABEL[r.status] ? t(locale, STATUS_LABEL[r.status]!) : r.status}
              />
            ))}
          </ListGroup>
        )}
      </section>

      <section className="mt-14">
        <SectionLabel>{t(locale, 'actions')}</SectionLabel>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <ActionCard
            title={t(locale, 'export_my_data')}
            description={t(locale, 'export_my_data_desc')}
            footer={<ExportButton locale={locale} />}
          />
          <ActionCard
            title={t(locale, 'request_erasure')}
            description={t(locale, 'request_erasure_desc')}
            footer={<ErasureButton locale={locale} />}
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
