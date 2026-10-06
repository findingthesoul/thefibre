import { redirect } from 'next/navigation';
import { canManageWorkspace } from '@thefibre/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { APP_ORDER, isAppSlug, type AppSlug } from '@/lib/apps';
import {
  PageContainer,
  Breadcrumb,
  PageHeader,
  ErrorBanner,
} from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { MembersClient, type Member } from './members-client';

type Me = {
  user: { id: string; is_super_admin?: boolean };
  /** Role in the ACTIVE workspace — what decides who may manage it. */
  workspace_role?: string | null;
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
  const locale = await uiLocale();
  let me: Me | null = null;
  let members: Member[] = [];
  let installed: WorkspaceApp[] = [];
  let error: string | null = null;

  try {
    me = await apiFetch<Me>('/api/v1/auth/me');
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  const isWorkspaceAdmin = canManageWorkspace(me);

  if (me && !isWorkspaceAdmin) {
    // NOT a redirect. It used to `redirect('/settings')`, which is the page
    // the link was clicked FROM — so the browser went from /settings to
    // /settings, nothing moved, nothing was said, and the entry looked
    // broken (Sjoerd, 2026-10-06: Apps and Members "don't respond when
    // clicked: no navigation, no message"). The hub no longer offers this
    // door to people who cannot open it; this is what a direct link or an
    // old bookmark gets, and it says which it is.
    return (
      <PageContainer max="4xl">
        <PageHeader title="Members" description="Managing the workspace is for its admins." />
        <p className="mt-6 text-sm text-ink-subtle">
          Your account can use this workspace but not change who is in it. An admin of this
          workspace can give you that, or make the change for you.
        </p>
      </PageContainer>
    );
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
      <Breadcrumb href="/settings" label={t(locale, 'nav_settings')} />
      <PageHeader
        title={t(locale, 'members_title')}
        description={t(locale, 'members_blurb')}
      />

      {error && <ErrorBanner>{t(locale, 'members_load_failed')} {error}</ErrorBanner>}

      {!error && <MembersClient members={members} appSlugs={appSlugs} locale={locale} />}
    </PageContainer>
  );
}
