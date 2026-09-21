import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, PageHeader, ErrorBanner, SectionLabel } from '@/components/ui/page';
import { CARD, INSET } from '@thefibre/shared/ui/recipes';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { ConsentButtons } from './consent';
import type { ConsentParams } from './actions';

// /connect — the consent page for connecting a person's own assistant
// (docs/mcp-personal-access-plan.md §3.2). The API's OAuth provider sends the
// browser here with the client's request in the query string; the page shows
// who is asking and what they would be able to read, in the workspace the
// person is currently in, and offers exactly two buttons. It lives inside
// the signed-in shell so an unsigned visitor is asked to sign in first and
// comes back here afterwards.

export const metadata = { title: 'Connect an assistant · The Fibre' };

type ClientInfo = {
  client_id: string;
  name: string;
  client_uri: string | null;
  logo_uri: string | null;
  redirect_hosts: string[];
  scopes: { scope: string; words: string }[];
};
type Me = { workspace: { id: string; name: string } | null };

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const locale = await uiLocale();

  const params: { [K in keyof ConsentParams]: ConsentParams[K] | undefined } = {
    client_id: one('client_id'),
    redirect_uri: one('redirect_uri'),
    state: one('state'),
    code_challenge: one('code_challenge'),
    code_challenge_method: one('code_challenge_method') === 'S256' ? 'S256' : undefined,
    scope: one('scope'),
    resource: one('resource'),
  };
  const complete = !!(params.client_id && params.redirect_uri && params.code_challenge && params.code_challenge_method);

  let client: ClientInfo | null = null;
  let me: Me | null = null;
  let error: string | null = null;
  if (complete) {
    try {
      [client, me] = await Promise.all([
        apiFetch<ClientInfo>(`/api/v1/mcp-auth/client?client_id=${encodeURIComponent(params.client_id!)}${params.scope ? `&scope=${encodeURIComponent(params.scope)}` : ''}`),
        apiFetch<Me>('/api/v1/auth/me'),
      ]);
    } catch (e) {
      error = e instanceof ApiError && e.status === 404 ? t(locale, 'connect_unknown_client') : e instanceof ApiError ? `API ${e.status}` : 'unknown error';
    }
  }

  return (
    <PageContainer max="3xl">
      <PageHeader title={t(locale, 'connect_title')} description={t(locale, 'connect_lead')} />
      {!complete && <ErrorBanner>{t(locale, 'connect_incomplete')}</ErrorBanner>}
      {error && <ErrorBanner>{error}</ErrorBanner>}

      {client && me && (
        <section className={`${CARD} mt-6 space-y-6 p-6`}>
          <div className="flex items-start gap-4">
            {client.logo_uri ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={client.logo_uri} alt="" className="h-10 w-10 rounded-md border border-line object-cover" />
            ) : null}
            <div>
              <p className="text-lg font-medium text-ink">{client.name}</p>
              <p className="text-sm text-ink-subtle">
                {t(locale, 'connect_asks_for', { workspace: me.workspace?.name ?? '' })}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {t(locale, 'connect_returns_to')} {client.redirect_hosts.join(', ')}
              </p>
            </div>
          </div>

          <div>
            <SectionLabel>{t(locale, 'connect_may_read')}</SectionLabel>
            <ul className="mt-2 space-y-2">
              {client.scopes.map((s) => (
                <li key={s.scope} className={`${INSET} px-3 py-2 text-sm text-ink`}>
                  {s.words}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-muted">{t(locale, 'connect_fine_print')}</p>
          </div>

          <ConsentButtons params={params as ConsentParams} locale={locale} />
        </section>
      )}
    </PageContainer>
  );
}
