import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, PageHeader, Breadcrumb, SectionLabel, ErrorBanner } from '@/components/ui/page';
import { CARD } from '@thefibre/shared/ui/recipes';
import { uiLocale } from '@/lib/locale';
import { t, INTL_LOCALES } from '@/lib/i18n-ui';
import { KeyForm } from './key-form';

// Settings → Assistant (docs/assistant-in-app.md §1.4 + §6.2). Three answers
// in one screen: is it on here and on whose key, how much has it used, and
// the door to bringing your own key. Counts only — the page never shows
// what anyone asked.

export const metadata = { title: 'Assistant · Settings' };

type Status = {
  enabled: boolean;
  source: 'workspace' | 'platform' | null;
  reason: 'no_platform_key' | 'plan' | 'budget' | null;
  plan: { id: string; name: string; allows: boolean; tokens_day: number | null };
  budget: { day: string; used_tokens: number; limit_tokens: number | null };
  key_hint: string | null;
};
type UsageRow = { day: string; source: string; turns: number; input_tokens: number; output_tokens: number };
type Me = { user: { id: string; is_super_admin?: boolean }; memberships: { app: { slug: string } | { slug: string }[] | null; role: string }[] };

export default async function AssistantSettingsPage() {
  const locale = await uiLocale();
  const nf = new Intl.NumberFormat(INTL_LOCALES[locale]);
  const df = new Intl.DateTimeFormat(INTL_LOCALES[locale], { dateStyle: 'medium' });

  let status: Status | null = null;
  let usage: UsageRow[] = [];
  let me: Me | null = null;
  let error: string | null = null;
  try {
    [status, me] = await Promise.all([apiFetch<Status>('/api/v1/assistant/status'), apiFetch<Me>('/api/v1/auth/me')]);
    usage = (await apiFetch<{ items: UsageRow[] }>('/api/v1/assistant/usage')).items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  const isAdmin =
    !!me?.user.is_super_admin ||
    (me?.memberships?.some((m) => {
      const app = Array.isArray(m.app) ? m.app[0] : m.app;
      return app?.slug === 'fibre-platform' && (m.role === 'admin' || m.role === 'super_admin');
    }) ?? false);

  function statusLine(s: Status): string {
    if (s.source === 'workspace') return t(locale, 'assistant_status_workspace_key', { hint: s.key_hint ?? '' });
    if (s.source === 'platform')
      return t(locale, 'assistant_status_platform', {
        plan: s.plan.name,
        used: nf.format(s.budget.used_tokens),
        limit: s.budget.limit_tokens === null ? '∞' : nf.format(s.budget.limit_tokens),
      });
    if (s.reason === 'budget') return t(locale, 'assistant_status_budget', { limit: nf.format(s.budget.limit_tokens ?? 0) });
    if (s.reason === 'plan') return t(locale, 'assistant_status_plan', { plan: s.plan.name });
    return t(locale, 'assistant_status_off');
  }

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/settings" label={t(locale, 'nav_settings')} />
      <PageHeader title={t(locale, 'assistant_title')} description={t(locale, 'assistant_lead')} />
      {error && <ErrorBanner>{error}</ErrorBanner>}

      {status && (
        <section className={`${CARD} p-5`}>
          <p className="text-sm text-ink">{statusLine(status)}</p>
        </section>
      )}

      <section className="mt-8 space-y-3">
        <SectionLabel>{t(locale, 'assistant_own_key_title')}</SectionLabel>
        <p className="text-sm text-ink-subtle">{t(locale, 'assistant_own_key_body')}</p>
        <KeyForm locale={locale} hint={status?.key_hint ?? null} isAdmin={isAdmin} />
      </section>

      <section className="mt-10 space-y-3">
        <SectionLabel>{t(locale, 'assistant_usage_title')}</SectionLabel>
        {usage.length === 0 ? (
          <p className="text-sm text-ink-muted">{t(locale, 'assistant_usage_none')}</p>
        ) : (
          <div className="overflow-x-auto">
            <p className="mb-1 text-[11px] text-ink-muted">{t(locale, 'assistant_usage_cols')}</p>
            <table className="w-full text-sm">
              <tbody>
                {usage.map((r) => (
                  <tr key={`${r.day}-${r.source}`} className="border-t border-line">
                    <td className="py-1.5 pr-4 text-ink">{df.format(new Date(r.day))}</td>
                    <td className="py-1.5 pr-4 tabular-nums text-ink-subtle">{nf.format(r.turns)}</td>
                    <td className="py-1.5 pr-4 tabular-nums text-ink-subtle">{nf.format(r.input_tokens)}</td>
                    <td className="py-1.5 pr-4 tabular-nums text-ink-subtle">{nf.format(r.output_tokens)}</td>
                    <td className="py-1.5 text-ink-muted">
                      {t(locale, r.source === 'workspace' ? 'assistant_source_workspace' : 'assistant_source_platform')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageContainer>
  );
}
