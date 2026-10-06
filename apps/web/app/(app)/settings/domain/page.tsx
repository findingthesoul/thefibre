import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, Breadcrumb, PageHeader, ErrorBanner } from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { DomainForm, type DomainState, type WorkspaceSender } from './domain-form';

// Your domain — the domain package's one screen (docs/domain-package.md).
//
// Two halves, sold as one Enterprise package and arriving in two parts:
// sending email from your own address (Pro and up, here now) and hosting the
// public pages on your own web address (Enterprise, part 2). The admin types
// a domain; THE API registers it with the mail provider using the server's
// key and answers with the DNS records to add; this page shows them with
// copy buttons and a Check. Until the provider says verified, mail keeps
// going out from the platform address with the workspace's name — nothing to
// flip when it does.

export const metadata = { title: 'Your domain · The Fibre' };

export default async function DomainSettingsPage() {
  const locale = await uiLocale();
  let domain: DomainState | null = null;
  let sender: WorkspaceSender | null = null;
  let error: string | null = null;
  try {
    [domain, sender] = await Promise.all([
      apiFetch<DomainState>('/api/v1/workspace-domain'),
      apiFetch<WorkspaceSender>('/api/v1/workspace'),
    ]);
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/settings" label={t(locale, 'nav_settings')} />
      <PageHeader title={t(locale, 'domain_title')} description={t(locale, 'domain_page_blurb')} />
      {error && <ErrorBanner>{t(locale, 'workspace_load_failed')} {error}</ErrorBanner>}
      {domain && sender && <DomainForm domain={domain} sender={sender} locale={locale} />}
    </PageContainer>
  );
}
