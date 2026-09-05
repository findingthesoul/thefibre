import { appUrl } from '@thefibre/shared';
import { apiFetch } from '@/lib/api';
import { Breadcrumb, PageContainer, PageHeader } from '../page-chrome';
import { JoinPageCard } from '../join-page-card';
import { loadSettings } from '../shared';

type Me = { workspace: { slug: string } | null };

export default async function JoinPageSettings() {
  const { settings, adminOnly } = await loadSettings();
  const me = await apiFetch<Me>('/api/v1/auth/me').catch(() => null);
  const host = appUrl('membership', process.env);
  const publicUrl = me?.workspace?.slug
    ? `${host}/${encodeURIComponent(me.workspace.slug)}`
    : `${host}/<workspace-slug>`;

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/settings" label="Settings" />
      <PageHeader
        title="Join page"
        description="The public page where people become members."
      />
      <div className="mt-8">
        {adminOnly ? (
          <p className="rounded-lg border border-line bg-surface-raised px-4 py-3 text-sm text-ink-subtle">
            Workspace admins only.
          </p>
        ) : (
          <JoinPageCard
            joinPage={settings?.join_page ?? {}}
            publicUrl={publicUrl}
            initialLocale={settings?.locale ?? null}
          />
        )}
      </div>
    </PageContainer>
  );
}
