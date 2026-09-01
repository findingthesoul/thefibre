import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, Breadcrumb, PageHeader, ErrorBanner } from '@/components/ui/page';
import { WorkspaceForm, type Workspace } from './workspace-form';

// The workspace itself, in one place.
//
// Sjoerd, 2026-09-01: "Where can I change info from the workspace? Like name,
// address, logo, invoice." The honest answer was: the name nowhere at all —
// it was read-only on this page and no endpoint could change it — the address
// and tax number in Settings → Payments inside two other apps, and the logo in
// The Thread's email settings. Three places and a hole.
//
// One screen now, on the platform, because a workspace is not an app's
// property. The apps read it.

export const metadata = { title: 'Workspace · The Fibre' };

export default async function WorkspaceSettingsPage() {
  let ws: Workspace | null = null;
  let error: string | null = null;
  try {
    ws = await apiFetch<Workspace>('/api/v1/workspace');
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/settings" label="Settings" />
      <PageHeader
        title="Workspace"
        description="Its name, its logo, the details on its invoices, and who its email comes from."
      />
      {error && <ErrorBanner>Couldn&apos;t load the workspace: {error}</ErrorBanner>}
      {ws && <WorkspaceForm workspace={ws} />}
    </PageContainer>
  );
}
