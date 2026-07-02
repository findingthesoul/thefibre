import { apiFetch } from '@/lib/api';
import { PageContainer, PageHeader, Breadcrumb } from '@/components/ui/page';
import { WorkspaceForm } from './form';

type ThreadSettings = {
  workspace_id: string;
  email_from_mode: 'workspace' | 'team' | 'personal' | 'custom';
  email_from_name: string | null;
  email_footer_note: string | null;
  default_vendor_cut_percent: number;
};

export default async function WorkspaceSettingsPage() {
  const settings = await apiFetch<ThreadSettings>('/api/v1/thread/settings');
  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/settings" label="Settings" />
      <PageHeader
        title="Emails & defaults"
        description="How Thread emails present themselves, and workspace-level defaults."
      />
      <WorkspaceForm settings={settings} />
    </PageContainer>
  );
}
