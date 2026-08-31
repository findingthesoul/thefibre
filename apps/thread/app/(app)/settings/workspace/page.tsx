import { apiFetch } from '@/lib/api';
import { PageContainer, PageHeader, Breadcrumb } from '@/components/ui/page';
import { WorkspaceForm } from './form';

export type WorkspaceBrand = {
  workspace_name: string | null;
  brand_logo_url: string | null;
  email_from_name: string | null;
  email_from_address: string | null;
  email_reply_to: string | null;
  enrolment_note: string | null;
  editable: boolean;
};

export default async function WorkspaceSettingsPage() {
  const brand = await apiFetch<WorkspaceBrand>('/api/v1/workspace-brand');
  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/settings" label="Settings" />
      <PageHeader
        title="Emails & defaults"
        description="Whose email this is: the logo at the top, the name in the inbox, and what you want said inside the platform's own enrolment emails."
      />
      <WorkspaceForm brand={brand} />
    </PageContainer>
  );
}
