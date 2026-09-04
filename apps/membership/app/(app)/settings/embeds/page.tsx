import { appUrl } from '@thefibre/shared';
import { apiFetch } from '@/lib/api';
import { Breadcrumb, PageContainer, PageHeader } from '../page-chrome';
import { EmbedsCard } from '../embeds-card';

type Me = { workspace: { slug: string } | null };

export default async function EmbedsSettings() {
  const me = await apiFetch<Me>('/api/v1/auth/me').catch(() => null);
  const host = appUrl('membership', process.env);
  const workspaceSlug = me?.workspace?.slug ?? null;

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/settings" label="Settings" />
      <PageHeader
        title="Website embeds"
        description="Copy-paste snippets to show your tiers and take joins on any website."
      />
      <div className="mt-8">
        {workspaceSlug ? (
          <EmbedsCard host={host} workspaceSlug={workspaceSlug} />
        ) : (
          <p className="rounded-lg border border-line bg-surface-raised px-4 py-3 text-sm text-ink-subtle">
            Embed snippets need the workspace slug — it could not be loaded right now.
          </p>
        )}
      </div>
    </PageContainer>
  );
}
