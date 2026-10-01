import Link from 'next/link';
import { headers } from 'next/headers';
import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, PageHeader, Breadcrumb, SectionLabel, ErrorBanner } from '@/components/ui/page';
import { CARD } from '@thefibre/shared/ui/recipes';
import { mcpConnectorUrl } from '@thefibre/shared';
import { uiLocale } from '@/lib/locale';
import { t, INTL_LOCALES } from '@/lib/i18n-ui';
import { KeyForm } from './key-form';
import { ConnectorAddress } from './connector-address';

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
type Me = {
  user: { id: string; is_super_admin?: boolean };
  memberships: { app: { slug: string } | { slug: string }[] | null; role: string }[];
  /** The workspace this session acts in — its slug makes the connector address per-workspace. */
  workspace?: { id: string; slug: string; name: string } | null;
};

export default async function AssistantSettingsPage() {
  const locale = await uiLocale();
  const host = (await headers()).get('host');
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

  // The address is per WORKSPACE (2026-10-01): one Claude can hold several,
  // each a distinct connector, and the connection is pinned to the workspace
  // in the address rather than to whichever tab was open at Allow.
  const connectorUrl = mcpConnectorUrl(host, undefined, me?.workspace?.slug ?? null);
  const workspaceName = me?.workspace?.name ?? '';

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

      {/* The two doors, side by side. A is what the rest of this page
          configures; B is the person's own assistant, connected through the
          MCP address — the page they land on if they open that address in a
          browser. */}
      <section className="space-y-3">
        <SectionLabel>{t(locale, 'assistant_two_ways_title')}</SectionLabel>
        <div className="grid gap-4 md:grid-cols-2">
          <div className={`${CARD} p-5 space-y-2`}>
            <h3 className="text-sm font-medium text-ink">{t(locale, 'assistant_way_in_app_title')}</h3>
            <p className="text-sm text-ink-subtle">{t(locale, 'assistant_way_in_app_body')}</p>
            {status && <p className="text-sm text-ink pt-1">{statusLine(status)}</p>}
          </div>
          <div className={`${CARD} p-5 space-y-3`}>
            <h3 className="text-sm font-medium text-ink">{t(locale, 'assistant_way_own_title')}</h3>
            <p className="text-sm text-ink-subtle">{t(locale, 'assistant_way_own_body')}</p>
            <ConnectorAddress locale={locale} url={connectorUrl} />
            {workspaceName && <p className="text-xs text-ink-muted">{t(locale, 'assistant_connector_workspace_note', { workspace: workspaceName })}</p>}
            <p className="text-xs text-ink-muted">{t(locale, 'assistant_connector_steps', { url: connectorUrl })}</p>
            <Link href="/settings/connections" className="inline-block text-sm text-ink-subtle underline underline-offset-2 hover:text-ink">
              {t(locale, 'assistant_connector_manage')} →
            </Link>
          </div>
        </div>
      </section>

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
