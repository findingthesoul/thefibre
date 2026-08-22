import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  Breadcrumb,
  PageHeader,
  ErrorBanner,
} from '@/components/ui/page';
import { KeyManager, type KeyRow } from './manager';

type Me = {
  user: { id: string; is_super_admin?: boolean };
  memberships: { app: { slug: string } | { slug: string }[] | null; role: string }[];
};

type ManifestResponse = {
  app: { slug: string; name: string; status: string; kind: string };
  activity_types: string[];
};

export default async function AppKeysPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let me: Me | null = null;
  let error: string | null = null;
  try {
    me = await apiFetch<Me>('/api/v1/auth/me');
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  const explicitAdmin =
    me?.memberships?.some((m) => {
      const app = Array.isArray(m.app) ? m.app[0] : m.app;
      return app?.slug === 'fibre-platform' && m.role === 'admin';
    }) ?? false;
  if (me && !(explicitAdmin || me.user.is_super_admin)) redirect('/settings');

  let app: ManifestResponse['app'] | null = null;
  let scopes: string[] = [];
  try {
    const [manifest, catalogue] = await Promise.all([
      apiFetch<ManifestResponse>(`/api/v1/apps/${encodeURIComponent(slug)}/manifest`),
      apiFetch<{ items: { slug: string; manifest: Record<string, unknown> | null }[] }>(
        `/api/v1/apps?status=approved`,
      ),
    ]);
    app = manifest.app;
    // A key can never carry more than the manifest asked for, so the picker
    // offers exactly what the app declared — not the full vocabulary.
    const raw = catalogue.items.find((a) => a.slug === slug)?.manifest?.scopes_requested;
    scopes = Array.isArray(raw) ? raw.filter((s): s is string => typeof s === 'string') : [];
  } catch (e) {
    if (!error) error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  let keys: KeyRow[] = [];
  try {
    const data = await apiFetch<{ items: KeyRow[] }>(
      `/api/v1/apps/${encodeURIComponent(slug)}/keys`,
    );
    keys = data.items;
  } catch (e) {
    if (!error) error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/settings/apps" label="Apps" />
      <PageHeader
        title={`${app?.name ?? slug} — API keys`}
        description="Server-to-server credentials for this app in this workspace. An app key needs no signed-in browser, and can only do what its scopes allow."
      />

      {error && <ErrorBanner>Couldn't load keys: {error}</ErrorBanner>}

      <div className="mt-10">
        <KeyManager slug={slug} keys={keys} availableScopes={scopes} />
      </div>
    </PageContainer>
  );
}
