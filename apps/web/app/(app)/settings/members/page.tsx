import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { APP_ORDER, isAppSlug, type AppSlug } from '@/lib/apps';
import {
  PageContainer,
  Breadcrumb,
  PageHeader,
  ErrorBanner,
} from '@/components/ui/page';
import { MembersClient, type Member } from './members-client';

type Me = {
  user: { id: string; is_super_admin?: boolean };
  memberships: { app: { slug: string } | { slug: string }[] | null; role: string }[];
};

type AppRef = { slug: string; name: string; base_url: string | null };
type WorkspaceApp = {
  id: string;
  app_id: string;
  activated_at: string;
  deactivated_at: string | null;
  // PostgREST returns embedded FKs as either an object or a single-element array,
  // depending on relationship inference. Handle both.
  app: AppRef | AppRef[] | null;
};

function appOf(w: WorkspaceApp): AppRef | null {
  if (!w.app) return null;
  return Array.isArray(w.app) ? w.app[0] ?? null : w.app;
}

export default async function MembersPage() {
  let me: Me | null = null;
  let members: Member[] = [];
  let installed: WorkspaceApp[] = [];
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
  const isWorkspaceAdmin = explicitAdmin || !!me?.user.is_super_admin;

  if (me && !isWorkspaceAdmin) {
    // Settings → Members is admin-only. Non-admins go back to Settings.
    redirect('/settings');
  }

  try {
    const [membersRes, appsRes] = await Promise.all([
      apiFetch<{ items: Member[] }>('/api/v1/members'),
      apiFetch<{ items: WorkspaceApp[] }>('/api/v1/workspace-apps'),
    ]);
    members = membersRes.items;
    installed = appsRes.items;
  } catch (e) {
    if (!error) error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  // Only ACTIVATED apps get a grant column. Order follows APP_ORDER; the
  // platform itself is implicit (everyone in the workspace has it).
  const activatedSlugs = new Set(
    installed
      .filter((w) => !w.deactivated_at)
      .map((w) => appOf(w)?.slug)
      .filter((s): s is string => !!s),
  );
  const appSlugs: AppSlug[] = APP_ORDER.filter(
    (slug) => slug !== 'fibre-platform' && activatedSlugs.has(slug),
  ).filter(isAppSlug);

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/settings" label="Settings" />
      <PageHeader
        title="Members"
        description="The single place to manage who's in the workspace and which apps they can use. The apps show this — they don't edit it."
      />

      {error && <ErrorBanner>Couldn't load members: {error}</ErrorBanner>}

      {!error && <MembersClient members={members} appSlugs={appSlugs} />}
    </PageContainer>
  );
}
